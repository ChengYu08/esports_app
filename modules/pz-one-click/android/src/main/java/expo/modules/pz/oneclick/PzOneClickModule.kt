package expo.modules.pz.oneclick

import android.app.Activity
import android.app.AlertDialog
import android.app.Application
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Path
import android.graphics.RectF
import android.graphics.Typeface
import android.graphics.drawable.BitmapDrawable
import android.graphics.drawable.ColorDrawable
import android.graphics.drawable.GradientDrawable
import android.net.Uri
import android.text.SpannableStringBuilder
import android.text.Spanned
import android.text.TextPaint
import android.text.method.LinkMovementMethod
import android.text.style.ClickableSpan
import android.text.style.ForegroundColorSpan
import android.util.Log
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.RelativeLayout
import android.widget.TextView
import org.json.JSONObject
import com.mobile.auth.gatewayauth.AuthRegisterViewConfig
import com.mobile.auth.gatewayauth.AuthUIConfig
import com.mobile.auth.gatewayauth.PhoneNumberAuthHelper
import com.mobile.auth.gatewayauth.ResultCode
import com.mobile.auth.gatewayauth.TokenResultListener
import com.mobile.auth.gatewayauth.model.TokenRet
import expo.modules.kotlin.Promise
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.util.concurrent.atomic.AtomicBoolean
import java.lang.ref.WeakReference

private const val TAG = "PzOneClick"
private val PROTOCOL_BASE_URL =
  if (BuildConfig.DEBUG) "https://djpc.yingbowl.com" else "https://dj.panzhi.com"
private val USER_AGREEMENT_URL = "$PROTOCOL_BASE_URL/public/protocols?code=user_server"
private val PRIVACY_POLICY_URL = "$PROTOCOL_BASE_URL/public/protocols?code=user_privacy"

class PzOneClickModule : Module() {
  private var authHelper: PhoneNumberAuthHelper? = null
  // 栈顶 Activity 追踪：SDK 点击回调只给 Application context，
  // 弹自绘协议弹窗需要真正的授权页 Activity，只能靠自己记录 Activity 生命周期
  private var topActivityRef: WeakReference<Activity>? = null
  private var lifecycleCallbacks: Application.ActivityLifecycleCallbacks? = null

  private fun ensureActivityTracking(context: Context) {
    if (lifecycleCallbacks != null) {
      return
    }
    val app = context.applicationContext as? Application ?: return
    val callbacks = object : Application.ActivityLifecycleCallbacks {
      override fun onActivityResumed(activity: Activity) {
        topActivityRef = WeakReference(activity)
      }

      override fun onActivityPaused(activity: Activity) {}

      override fun onActivityStopped(activity: Activity) {}

      override fun onActivitySaveInstanceState(activity: Activity, outState: android.os.Bundle) {}

      override fun onActivityDestroyed(activity: Activity) {}

      override fun onActivityCreated(activity: Activity, savedInstanceState: android.os.Bundle?) {}

      override fun onActivityStarted(activity: Activity) {}
    }
    app.registerActivityLifecycleCallbacks(callbacks)
    lifecycleCallbacks = callbacks
  }

  override fun definition() = ModuleDefinition {
    Name("PzOneClick")
    Events("onStateChange")

    AsyncFunction("checkLoginAvailableAsync") { _: Map<String, String>, authSDKKey: String, promise: Promise ->
      val activity = appContext.currentActivity
      if (activity == null) {
        promise.reject("NO_ACTIVITY", "一键登录需要在前台页面中调用", null)
        return@AsyncFunction
      }
      if (authSDKKey.isBlank()) {
        Log.w(TAG, "[DEBUG-QUICK-LOGIN] SDK key is not configured")
        sendEvent("onStateChange", mapOf("state" to "unavailable"))
        promise.resolve(false)
        return@AsyncFunction
      }

      sendEvent("onStateChange", mapOf("state" to "checking"))
      val helper = createHelper(activity.applicationContext, object : TokenResultListener {
        private var finished = false

        override fun onTokenSuccess(result: String) {
          if (finished) return
          finished = true
          val code = resultCode(result)
          // SDK 文档规定 checkEnvAvailable 成功回调的是 600024 (CODE_ERROR_ENV_CHECK_SUCCESS)，
          // 但部分版本会回 600000。两个都视为可用。
          val available = code == ResultCode.CODE_SUCCESS || code == ResultCode.CODE_ERROR_ENV_CHECK_SUCCESS
          Log.i(TAG, "[DEBUG-QUICK-LOGIN] environment check completed: code=$code, available=$available")
          authHelper?.setAuthListener(null)
          sendEvent("onStateChange", mapOf("state" to if (available) "available" else "unavailable"))
          promise.resolve(available)
        }

        override fun onTokenFailed(result: String) {
          if (finished) return
          finished = true
          val code = resultCode(result)
          val message = resultMessage(result)
          Log.w(TAG, "[DEBUG-QUICK-LOGIN] environment check failed: code=$code, message=$message")
          authHelper?.setAuthListener(null)
          sendEvent("onStateChange", mapOf("state" to "unavailable"))
          promise.resolve(false)
        }
      })
      helper.setAuthSDKInfo(authSDKKey)
      helper.checkEnvAvailable(PhoneNumberAuthHelper.SERVICE_TYPE_LOGIN)
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("authorizeAsync") { _: Map<String, String>, authSDKKey: String, promise: Promise ->
      val activity = appContext.currentActivity
      if (activity == null) {
        promise.reject("NO_ACTIVITY", "一键登录需要在前台页面中调用", null)
        return@AsyncFunction
      }
      if (authSDKKey.isBlank()) {
        promise.reject("MISSING_AUTH_KEY", "未配置阿里云号码认证 Android key", null)
        return@AsyncFunction
      }

      sendEvent("onStateChange", mapOf("state" to "authorizing"))
      ensureActivityTracking(activity.applicationContext)
      // 自绘入口（暂不登录/用其它方式登录）与 SDK 回调共享同一个 fired 标记，保证 promise 只结算一次
      val fired = AtomicBoolean(false)
      val finishCancelled: (Boolean) -> Unit = { switched ->
        if (fired.compareAndSet(false, true)) {
          Log.i(TAG, "[DEBUG-QUICK-LOGIN] authorization cancelled: switched=$switched")
          authHelper?.setAuthListener(null)
          authHelper?.quitLoginPage()
          sendEvent("onStateChange", mapOf("state" to "cancelled"))
          promise.reject(
            if (switched) "USER_SWITCHED" else "USER_EXITED",
            "一键登录失败，请使用其他登录方式",
            null,
          )
        }
      }
      val helper = createHelper(activity.applicationContext, object : TokenResultListener {
        override fun onTokenSuccess(result: String) {
          val tokenRet = parseResult(result)
          val code = tokenRet?.code ?: "unknown"
          if (code == ResultCode.CODE_START_AUTHPAGE_SUCCESS) {
            Log.i(TAG, "[DEBUG-QUICK-LOGIN] authorization page presented")
            return
          }
          if (code == ResultCode.CODE_SUCCESS && !tokenRet?.token.isNullOrBlank()) {
            if (!fired.compareAndSet(false, true)) return
            val spToken = tokenRet?.token.orEmpty()
            Log.i(TAG, "[DEBUG-QUICK-LOGIN] carrier authorization succeeded")
            authHelper?.setAuthListener(null)
            authHelper?.quitLoginPage()
            promise.resolve(mapOf("spToken" to spToken))
            return
          }
          if (!fired.compareAndSet(false, true)) return
          Log.w(TAG, "[DEBUG-QUICK-LOGIN] unexpected authorization response: code=$code")
          authHelper?.setAuthListener(null)
          authHelper?.quitLoginPage()
          promise.reject("AUTHORIZATION_FAILED", "一键登录没有返回有效授权结果", null)
        }

        override fun onTokenFailed(result: String) {
          if (!fired.compareAndSet(false, true)) return
          val code = resultCode(result)
          val message = resultMessage(result)
          Log.i(TAG, "[DEBUG-QUICK-LOGIN] onTokenFailed: code=$code, message=$message")
          // 取消路径分两类，JS 侧要据此决定露出什么：
          // 700001 点「用其它方式登录」自绘入口 → 关掉授权页，露出下面的密码/验证码表单；
          // 700000/700010/700011 点返回按钮/返回键 → 退出登录页回首页。
          val cancelledBySwitch = code == ResultCode.CODE_ERROR_USER_SWITCH
          val cancelledByBack =
            code == ResultCode.CODE_ERROR_USER_CANCEL ||               // 700000
            code == ResultCode.CODE_ERROR_USER_CONTROL_CANCEL_BYBTN || // 700010
            code == ResultCode.CODE_ERROR_USER_CONTROL_CANCEL_BYKEY    // 700011 返回键
          val cancelled = cancelledBySwitch || cancelledByBack
          authHelper?.setAuthListener(null)
          // 失败/取消时都要关掉授权页，避免残留在 Activity 栈里。
          authHelper?.quitLoginPage()
          sendEvent("onStateChange", mapOf("state" to if (cancelled) "cancelled" else "unavailable"))
          promise.reject(
            when {
              cancelledBySwitch -> "USER_SWITCHED"
              cancelledByBack -> "USER_EXITED"
              else -> "AUTHORIZATION_FAILED"
            },
            "一键登录失败，请使用其他登录方式",
            null,
          )
        }
      })
      helper.setAuthSDKInfo(authSDKKey)
      helper.setAuthUIConfig(authUIConfig(activity))
      // 自绘「暂不登录，先去逛逛」与底部「用其它方式登录」入口
      registerAuthPageCustomViews(
        onUserExit = { finishCancelled(false) },
        onUserSwitch = { finishCancelled(true) },
      )
      // 未勾选协议时点「一键登录」：SDK 内置弹窗已关闭，这里弹自绘双按钮协议弹窗。
      // 注意：SDK 回调的 context 只是 Application context，拿不到授权页 Activity，
      // 弹窗宿主靠 ensureActivityTracking 记录的栈顶 Activity（点击时即授权页）。
      helper.setUIClickListener { code, _, json ->
        Log.i(TAG, "[DEBUG-QUICK-LOGIN] UI click: code=$code, json=$json")
        if (code != ResultCode.CODE_ERROR_USER_LOGIN_BTN) {
          return@setUIClickListener
        }
        // json 的 isChecked 是 SDK 在点击瞬间给的勾选状态，优先于 queryCheckBoxIsChecked()
        val checked = try {
          JSONObject(json).optBoolean("isChecked")
        } catch (_: Exception) {
          authHelper?.queryCheckBoxIsChecked() == true
        }
        if (!checked) {
          showPrivacyConfirmDialog()
        }
      }
      helper.getLoginToken(activity, 8000)
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("cancelAsync") { promise: Promise ->
      authHelper?.apply {
        quitLoginPage()
        setAuthListener(null)
      }
      sendEvent("onStateChange", mapOf("state" to "cancelled"))
      promise.resolve(null)
    }.runOnQueue(Queues.MAIN)
  }

  private fun createHelper(context: android.content.Context, listener: TokenResultListener): PhoneNumberAuthHelper {
    return PhoneNumberAuthHelper.getInstance(context, listener).also {
      authHelper = it
      it.reporter.setLoggerEnable(false)
    }
  }

  // ---- Figma 授权页布局常量（375pt 宽设计稿，值为相对屏幕顶部的位置）----
  private val sloganScreenTopDp = 260
  private val numberScreenTopDp = 294
  private val loginBtnScreenTopDp = 388
  private val skipEntryScreenTopDp = 446
  private val authNavHeightDp = 44

  private fun dp(context: Context, value: Float): Int =
    (value * context.resources.displayMetrics.density).toInt()

  // SDK 的 offsetY 系列均相对导航栏底边，而设计稿位置相对屏幕顶部，
  // 需要运行时扣除状态栏高度做换算
  private fun statusBarHeightDp(context: Context): Int {
    val resources = context.resources
    val resourceId = resources.getIdentifier("status_bar_height", "dimen", "android")
    if (resourceId <= 0) {
      return 24
    }
    val px = resources.getDimensionPixelSize(resourceId)
    return (px / resources.displayMetrics.density).toInt()
  }

  private fun authUIConfig(activity: Activity): AuthUIConfig {
    val context: Context = activity
    val bodyTopDp = statusBarHeightDp(context) + authNavHeightDp
    // Figma 设计稿色板
    val brandPrimary = Color.rgb(254, 31, 76) // #FE1F4C
    val gray1 = Color.rgb(26, 26, 26)         // #1A1A1A
    val gray9 = Color.rgb(128, 128, 128)      // #808080
    val linkBlue = Color.rgb(27, 106, 224)    // #1B6AE0
    val carrier = authHelper?.getCurrentCarrierName().orEmpty().ifBlank { "运营商" }

    // Figma 按钮：高 42、圆角 8、红 #FE1F4C，左右边距 32dp
    val loginButton = GradientDrawable().apply {
      setColor(brandPrimary)
      cornerRadius = dp(context, 8f).toFloat()
    }
    return AuthUIConfig.Builder()
      // 授权页进出不做动画：退出时 RN 侧会立即盖一层全屏加载遮罩，
      // SDK 默认的 Activity 转场动画会和遮罩淡入打架，看起来像闪回登录页。
      .setAuthPageActIn("android:activity/fade_in", "android:activity/fade_out")
      .setAuthPageActOut("android:activity/fade_in", "android:activity/fade_out")
      // 顶部装饰图需要延伸到状态栏下面，导航栏透明悬浮在图上
      .setNavHidden(false)
      .setNavColor(Color.TRANSPARENT)
      .setStatusBarColor(Color.TRANSPARENT)
      // setLightColor(true) 表示「浅色状态栏图标」，配浅底会让文字看不见。
      // 改为 setStatusBarUIFlag 强制深色图标（SYSTEM_UI_FLAG_LIGHT_STATUS_BAR）。
      .setLightColor(false)
      .setStatusBarUIFlag(View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR)
      .setNavText("")
      .setNavTextColor(gray1)
      .setNavReturnImgDrawable(makeBackArrowDrawable(gray1))
      .setLogoHidden(true)
      .setPageBackgroundDrawable(makePageBackgroundDrawable(context))
      // 掩码手机号：MiSans Bold 32dp #1A1A1A（ttf 放 assets，SDK 从 assets 加载）
      .useNumberFontAndPath(true, "pz_misans_bold.ttf")
      .setNumberColor(gray1)
      .setNumberSizeDp(32)
      .setNumFieldOffsetY(numberScreenTopDp - bodyTopDp)
      // slogan「中国xx提供认证服务」
      .setSloganText("${carrier}提供认证服务")
      .setSloganTextColor(gray9)
      .setSloganTextSizeDp(14)
      .setSloganOffsetY(sloganScreenTopDp - bodyTopDp)
      // 一键登录主按钮
      .setLogBtnText("一键登录")
      .setLogBtnTextColor(Color.WHITE)
      .setLogBtnTextSizeDp(14)
      .setLogBtnHeight(42)
      .setLogBtnMarginLeftAndRight(32)
      .setLogBtnBackgroundDrawable(loginButton)
      .setLogBtnOffsetY(loginBtnScreenTopDp - bodyTopDp)
      // 「验证码或密码登录」切换按钮隐藏，入口改用自绘底部「用其它方式登录」圆形图标
      .setSwitchAccHidden(true)
      // 协议：默认未勾选（合规要求用户主动同意）
      .setPrivacyState(false)
      .setPrivacyBefore("已阅读并同意")
      .setPrivacyEnd("，未注册用户在登录成功后自动创建账号")
      // 运营商协议是 SDK 内置占位符（点击会跳到对应运营商页面）
      .setVendorPrivacyPrefix("《运营商协议》")
      .setVendorPrivacySuffix("")
      .setAppPrivacyOne("《用户协议》", USER_AGREEMENT_URL)
      .setAppPrivacyTwo("《隐私政策》", PRIVACY_POLICY_URL)
      .setAppPrivacyColor(gray9, linkBlue)
      .setPrivacyTextSizeDp(12)
      .setPrivacyMargin(32)
      .setPrivacyOffsetY_B(56)
      .setCheckboxHidden(false)
      .setCheckBoxWidth(16)
      .setCheckBoxHeight(16)
      .setCheckedImgDrawable(makeCheckboxDrawable(context, true))
      .setUncheckedImgDrawable(makeCheckboxDrawable(context, false))
      // SDK 内置 privacyAlert 弹窗布局不可靠（自定义尺寸会拉伸到全屏，默认又太窄），
      // 且它只有一个按钮，无法实现设计的双按钮布局。这里关闭它，
      // 未勾选时点「一键登录」走 UIClickListener 弹自绘 AlertDialog。
      .setPrivacyAlertIsNeedShow(false)
      .setPrivacyAlertIsNeedAutoLogin(false)
      .setLogBtnToastHidden(true)
      // 协议 WebView 的安全区：导航栏 + 状态栏都用白色，避免顶部被状态栏遮挡
      .setWebViewStatusBarColor(Color.WHITE)
      .setWebNavColor(Color.WHITE)
      .setWebNavTextColor(gray1)
      .setWebNavTextSizeDp(18)
      .create()
  }

  // 注册自绘控件：一键登录按钮下方的「暂不登录，先去逛逛」和底部的「用其它方式登录」圆形入口
  private fun registerAuthPageCustomViews(onUserExit: () -> Unit, onUserSwitch: () -> Unit) {
    val context = appContext.reactContext ?: return
    // 重复进入授权页时先清理旧的自绘控件，避免 SDK 叠加注册
    authHelper?.removeAuthRegisterViewConfig()

    val skipBtn = TextView(context).apply {
      text = "暂不登录，先去逛逛"
      textSize = 12f
      setTextColor(Color.rgb(153, 153, 153)) // #999999
      gravity = Gravity.CENTER
      setOnClickListener { onUserExit() }
    }
    val bodyTopDp = statusBarHeightDp(context) + authNavHeightDp
    skipBtn.layoutParams = RelativeLayout.LayoutParams(
      ViewGroup.LayoutParams.MATCH_PARENT,
      ViewGroup.LayoutParams.WRAP_CONTENT,
    ).apply {
      topMargin = dp(context, (skipEntryScreenTopDp - bodyTopDp).toFloat())
    }

    // 底部「用其它方式登录」入口：40dp 圆形底图 + 12dp #808080 文字，点击切换到验证码登录
    val otherWay = LinearLayout(context).apply {
      orientation = LinearLayout.VERTICAL
      gravity = Gravity.CENTER
      val icon = ImageView(context).apply {
        setImageResource(R.drawable.pz_login_other_way)
      }
      val label = TextView(context).apply {
        text = "用其它方式登录"
        textSize = 12f
        setTextColor(Color.rgb(128, 128, 128)) // #808080
        gravity = Gravity.CENTER
      }
      addView(icon, LinearLayout.LayoutParams(dp(context, 40f), dp(context, 40f)))
      addView(
        label,
        LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply {
          topMargin = dp(context, 4f)
        },
      )
      setOnClickListener { onUserSwitch() }
    }
    // 图标底部距协议栏顶部 64dp；协议栏距屏底 56dp、两行 12dp 文字约 34dp 高
    otherWay.layoutParams = RelativeLayout.LayoutParams(
      ViewGroup.LayoutParams.WRAP_CONTENT,
      ViewGroup.LayoutParams.WRAP_CONTENT,
    ).apply {
      addRule(RelativeLayout.CENTER_HORIZONTAL)
      addRule(RelativeLayout.ALIGN_PARENT_BOTTOM)
      bottomMargin = dp(context, (56 + 34 + 64).toFloat())
    }

    authHelper?.addAuthRegistViewConfig(
      "pz_skip_entry",
      AuthRegisterViewConfig.Builder()
        .setRootViewId(AuthRegisterViewConfig.RootViewId.ROOT_VIEW_ID_BODY)
        .setView(skipBtn)
        .build(),
    )
    authHelper?.addAuthRegistViewConfig(
      "pz_other_way",
      AuthRegisterViewConfig.Builder()
        .setRootViewId(AuthRegisterViewConfig.RootViewId.ROOT_VIEW_ID_BODY)
        .setView(otherWay)
        .build(),
    )
  }

  /// 页面背景：白底 + 顶部 208/375 比例装饰图 + 从 196dp 起的白色圆角卡片。
  /// 合成一张位图交给 SDK，避免多个自绘 View 与 SDK 控件的层级问题。
  private fun makePageBackgroundDrawable(context: Context): BitmapDrawable {
    val metrics = context.resources.displayMetrics
    val width = metrics.widthPixels
    val height = metrics.heightPixels
    val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
    val canvas = Canvas(bitmap)
    canvas.drawColor(Color.WHITE)

    val source = BitmapFactory.decodeResource(context.resources, R.drawable.pz_login_top_bg)
    val topHeight = (width * 208f / 375f).toInt()
    val scaled = Bitmap.createScaledBitmap(source, width, topHeight, true)
    canvas.drawBitmap(scaled, 0f, 0f, null)

    // 白色卡片：顶部两个 12dp 圆角，盖住装饰图底部与内容的分界
    val radius = dp(context, 12f).toFloat()
    val cardTop = dp(context, 196f).toFloat()
    val cardRect = RectF(0f, cardTop, width.toFloat(), height.toFloat())
    val cardPath = Path().apply {
      addRoundRect(
        cardRect,
        floatArrayOf(radius, radius, radius, radius, 0f, 0f, 0f, 0f),
        Path.Direction.CW,
      )
    }
    canvas.drawPath(cardPath, Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.WHITE })

    return BitmapDrawable(context.resources, bitmap)
  }

  /// 16dp 勾选框：未勾选 #CCCCCC 空心圆，勾选 #FE1F4C 实底 + 白色对勾，与设计稿 Small-16 一致。
  private fun makeCheckboxDrawable(context: Context, checked: Boolean): BitmapDrawable {
    val size = dp(context, 16f)
    val bitmap = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
    val canvas = Canvas(bitmap)
    val inset = dp(context, 1f).toFloat()
    val circle = RectF(inset, inset, size - inset, size - inset)
    if (checked) {
      canvas.drawOval(
        circle,
        Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.rgb(254, 31, 76) },
      )
      val check = Path().apply {
        moveTo(size * 0.28f, size * 0.53f)
        lineTo(size * 0.44f, size * 0.69f)
        lineTo(size * 0.74f, size * 0.33f)
      }
      canvas.drawPath(
        check,
        Paint(Paint.ANTI_ALIAS_FLAG).apply {
          color = Color.WHITE
          style = Paint.Style.STROKE
          strokeWidth = dp(context, 1.6f).toFloat()
          strokeCap = Paint.Cap.ROUND
          strokeJoin = Paint.Join.ROUND
        },
      )
    } else {
      canvas.drawOval(
        circle,
        Paint(Paint.ANTI_ALIAS_FLAG).apply {
          color = Color.rgb(204, 204, 204)
          style = Paint.Style.STROKE
          strokeWidth = dp(context, 1f).toFloat()
        },
      )
    }
    return BitmapDrawable(context.resources, bitmap)
  }

  // 运营商协议落地页：SDK 授权页内点击《运营商协议》跳的就是这些官方地址，
  // 弹窗正文里的链接保持与授权页一致
  private fun carrierProtocolUrl(): String {
    return when (authHelper?.getCurrentCarrierName()) {
      "中国电信" -> "https://e.189.cn/agreement/scope.do?masked=false"
      "中国联通" -> "https://opencloud.wostore.cn/auth/protocol/2a6d4e351f6a41d7a0adcbfcd4b0f11f/loginAuth.html"
      else -> "https://wap.cmpassport.com/resources/html/contract.html" // 中国移动/兜底
    }
  }

  // 用 App 内共用 WebView（Expo Router /web-view）打开协议，避免跳外部浏览器
  private fun openProtocol(activity: Activity, url: String, title: String) {
    try {
      val link = Uri.parse("esportsapp://web-view")
        .buildUpon()
        .appendQueryParameter("url", url)
        .appendQueryParameter("title", title)
        .build()
      activity.startActivity(Intent(Intent.ACTION_VIEW, link))
    } catch (error: Exception) {
      Log.w(TAG, "[DEBUG-QUICK-LOGIN] failed to open protocol url", error)
    }
  }

  // 未勾选协议时点「一键登录」弹出的双按钮协议弹窗（Figma 211:119294：宽 295、圆角 12、遮罩 60%）
  private fun showPrivacyConfirmDialog() {
    // SDK 授权页是一个独立的全屏 Activity，点击「一键登录」时它就是栈顶；
    // 弹窗挂在它上面才能显示在最上层（挂在 RN 主页面上会被授权页挡住）
    val activity = topActivityRef?.get() ?: appContext.currentActivity
    if (activity == null) {
      Log.w(TAG, "[DEBUG-QUICK-LOGIN] privacy dialog skipped: no top activity")
      return
    }
    // Figma 色板
    val gray11 = Color.rgb(51, 51, 51)    // #333333 标题/不同意文字
    val gray10 = Color.rgb(102, 102, 102) // #666666 正文
    val borderColor = Color.rgb(235, 235, 235) // #EBEBEB 不同意描边
    val brandPrimary = Color.rgb(254, 31, 76)  // #FE1F4C 同意按钮
    val linkBlue = Color.rgb(27, 106, 224)      // #1B6AE0 协议链接

    val title = TextView(activity).apply {
      text = "阅读并同意以下协议"
      textSize = 16f
      setTextColor(gray11)
      typeface = Typeface.defaultFromStyle(Typeface.BOLD)
      gravity = Gravity.CENTER
    }

    // 正文：三个协议名都是蓝色可点击链接，与授权页底部协议栏一致
    val preText = "已阅读并同意"
    val operatorName = "《运营商协议》"
    val userName = "《用户协议》"
    val privacyName = "《隐私政策》"
    val sufText = "，未注册用户在登录成功后自动创建账号"
    val links = mapOf(
      operatorName to carrierProtocolUrl(),
      userName to USER_AGREEMENT_URL,
      privacyName to PRIVACY_POLICY_URL,
    )
    val titles = mapOf(
      operatorName to "运营商协议",
      userName to "用户协议",
      privacyName to "隐私政策",
    )
    val content = SpannableStringBuilder().apply {
      append(preText)
      for ((name, url) in links) {
        val start = length
        append(name)
        setSpan(
          object : ClickableSpan() {
            override fun onClick(widget: View) {
              openProtocol(activity, url, titles[name] ?: "协议")
            }

            // 去掉链接默认下划线，只保留蓝色文字
            override fun updateDrawState(ds: TextPaint) {
              ds.isUnderlineText = false
            }
          },
          start,
          length,
          Spanned.SPAN_EXCLUSIVE_EXCLUSIVE,
        )
        setSpan(ForegroundColorSpan(linkBlue), start, length, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
      }
      append(sufText)
    }
    val contentView = TextView(activity).apply {
      text = content
      textSize = 14f
      setTextColor(gray10)
      gravity = Gravity.CENTER
      movementMethod = LinkMovementMethod.getInstance()
      highlightColor = Color.TRANSPARENT
      setLineSpacing(dp(activity, 6f).toFloat(), 1f)
    }

    // 按钮 Middle-36：高 36、圆角 8；不同意 hug 宽 + 1px #EBEBEB 描边，同意协议并继续 fill 品牌红
    val disagree = TextView(activity).apply {
      text = "不同意"
      textSize = 14f
      setTextColor(gray11)
      typeface = Typeface.defaultFromStyle(Typeface.BOLD)
      gravity = Gravity.CENTER
      setPadding(dp(activity, 16f), dp(activity, 8f), dp(activity, 16f), dp(activity, 8f))
      background = GradientDrawable().apply {
        setColor(Color.WHITE)
        setStroke(1, borderColor)
        cornerRadius = dp(activity, 8f).toFloat()
      }
    }
    val agree = TextView(activity).apply {
      text = "同意协议并继续"
      textSize = 14f
      setTextColor(Color.WHITE)
      typeface = Typeface.defaultFromStyle(Typeface.BOLD)
      gravity = Gravity.CENTER
      background = GradientDrawable().apply {
        setColor(brandPrimary)
        cornerRadius = dp(activity, 8f).toFloat()
      }
    }
    // 按钮组：左右 16、下 16、两按钮间距 12
    val buttonRow = LinearLayout(activity).apply {
      orientation = LinearLayout.HORIZONTAL
      addView(
        disagree,
        LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, dp(activity, 36f)),
      )
      addView(
        agree,
        LinearLayout.LayoutParams(0, dp(activity, 36f), 1f).apply {
          marginStart = dp(activity, 12f)
        },
      )
    }
    // 内容区：四周 16，标题-正文间距 12，正文-按钮间距 4
    val root = LinearLayout(activity).apply {
      orientation = LinearLayout.VERTICAL
      background = GradientDrawable().apply {
        setColor(Color.WHITE)
        cornerRadius = dp(activity, 12f).toFloat()
      }
      setPadding(dp(activity, 16f), dp(activity, 16f), dp(activity, 16f), 0)
      addView(title)
      addView(
        contentView,
        LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply {
          topMargin = dp(activity, 12f)
        },
      )
      addView(
        buttonRow,
        LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply {
          topMargin = dp(activity, 4f)
          bottomMargin = dp(activity, 16f)
        },
      )
    }

    val dialog = AlertDialog.Builder(activity).setView(root).create()
    dialog.setCanceledOnTouchOutside(true)
    disagree.setOnClickListener { dialog.dismiss() }
    agree.setOnClickListener {
      // 勾选协议后自动触发登录，用户无需再点一次「一键登录」
      authHelper?.setProtocolChecked(true)
      dialog.dismiss()
      performLoginButtonClick(activity)
    }
    dialog.show()
    dialog.window?.apply {
      setBackgroundDrawable(ColorDrawable(Color.TRANSPARENT))
      // AlertDialog 默认遮罩即 60%，与设计稿一致
      setLayout(dp(activity, 295f), ViewGroup.LayoutParams.WRAP_CONTENT)
    }
  }

  // 同意协议后模拟点击 SDK 授权页的「一键登录」按钮，走 SDK 原生取号流程
  private fun performLoginButtonClick(activity: Activity) {
    val decor = activity.window?.decorView ?: return
    decor.post {
      try {
        val loginTV = reflectAuthPageView(activity, "mLoginTV")
        val loginRL = reflectAuthPageView(activity, "mLoginRL")
        val target = listOfNotNull(loginTV, loginRL).firstOrNull { it.hasOnClickListeners() }
        if (target == null) {
          Log.w(TAG, "[DEBUG-QUICK-LOGIN] login button not found on auth page")
          return@post
        }
        target.performClick()
      } catch (error: Exception) {
        Log.w(TAG, "[DEBUG-QUICK-LOGIN] failed to auto trigger login", error)
      }
    }
  }

  // 反射读取 LoginAuthActivity 的私有 View 字段
  private fun reflectAuthPageView(activity: Activity, fieldName: String): View? {
    return try {
      val field = activity.javaClass.getDeclaredField(fieldName)
      field.isAccessible = true
      field.get(activity) as? View
    } catch (_: Exception) {
      null
    }
  }

  /// 24×24 黑色左箭头 Drawable，与二级页面 ChevronLeft24Regular 视觉一致。
  private fun makeBackArrowDrawable(color: Int): BitmapDrawable {
    val density = appContext.reactContext?.resources?.displayMetrics?.density ?: 1f
    val size = (24f * density).toInt().coerceAtLeast(24)
    val bitmap = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
    val canvas = Canvas(bitmap)
    val stroke = 1.75f * density
    val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
      this.color = color
      style = Paint.Style.STROKE
      strokeWidth = stroke
      strokeCap = Paint.Cap.ROUND
      strokeJoin = Paint.Join.ROUND
    }
    // 中心箭头朝左：M15.5 4.5 L8 12 L15.5 19.5（24 视口坐标）
    val scale = size / 24f
    val path = Path().apply {
      moveTo(15.5f * scale, 4.5f * scale)
      lineTo(8f * scale, 12f * scale)
      lineTo(15.5f * scale, 19.5f * scale)
    }
    canvas.drawPath(path, paint)
    val resources = appContext.reactContext?.resources
    return BitmapDrawable(resources, bitmap)
  }

  private fun parseResult(result: String): TokenRet? = try {
    TokenRet.fromJson(result)
  } catch (error: Exception) {
    Log.w(TAG, "[DEBUG-QUICK-LOGIN] SDK returned an unreadable response", error)
    null
  }

  private fun resultCode(result: String): String = parseResult(result)?.code ?: "unknown"

  private fun resultMessage(result: String): String = try {
    JSONObject(result).optString("msg").take(200)
  } catch (_: Exception) {
    ""
  }
}
