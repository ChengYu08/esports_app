-- 添加一键登录的key

-- 1. 授权类型：iOS 和安卓都加上
UPDATE pzds_platform.sys_oauth_client_details
  SET authorized_grant_types =
    CONCAT_WS(',',
      authorized_grant_types,
      IF(FIND_IN_SET('ali_h5_one_key', authorized_grant_types) = 0, 'ali_h5_one_key', NULL),
      IF(FIND_IN_SET('ali_app_one_key', authorized_grant_types) = 0, 'ali_app_one_key', NULL)
    )
  WHERE client_id IN ('dianjing-ios', 'dianjing-android');

-- 2. 社交平台配置：iOS（仅当不存在时）
INSERT INTO `pzds_user`.`app_social_details`
  (id, client_id, type, remark, app_id, app_secret, redirect_url, ext, create_by, update_by, create_time, update_time, del_flag)
SELECT (SELECT COALESCE(MAX(id), 0) + 1 FROM `pzds_user`.`app_social_details`), 'dianjing-ios', 'ALI_H5_ONE_KEY', remark, app_id, app_secret, redirect_url, ext, create_by, update_by, NOW(), NOW(), del_flag
FROM `pzds_user`.`app_social_details`
WHERE client_id = 'android' AND type = 'ALI_APP_ONE_KEY' AND del_flag = '0'
  AND NOT EXISTS (SELECT 1 FROM `pzds_user`.`app_social_details`
                  WHERE client_id = 'dianjing-ios' AND type = 'ALI_H5_ONE_KEY');

-- 3. 社交平台配置：安卓（仅当不存在时）
INSERT INTO `pzds_user`.`app_social_details`
  (id, client_id, type, remark, app_id, app_secret, redirect_url, ext, create_by, update_by, create_time, update_time, del_flag)
SELECT (SELECT COALESCE(MAX(id), 0) + 1 FROM `pzds_user`.`app_social_details`), 'dianjing-android', 'ALI_H5_ONE_KEY', remark, app_id, app_secret, redirect_url, ext, create_by, update_by, NOW(), NOW(), del_flag
FROM `pzds_user`.`app_social_details`
WHERE client_id = 'android' AND type = 'ALI_APP_ONE_KEY' AND del_flag = '0'
  AND NOT EXISTS (SELECT 1 FROM `pzds_user`.`app_social_details`
                  WHERE client_id = 'dianjing-android' AND type = 'ALI_H5_ONE_KEY');
