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

-- 2. 社交平台配置：保证以下四条记录都存在（仅当不存在时插入）
--    dianjing-ios     ALI_APP_ONE_KEY
--    dianjing-android ALI_APP_ONE_KEY
--    dianjing-ios     ALI_H5_ONE_KEY
--    dianjing-android ALI_H5_ONE_KEY
-- 以现有 android / ALI_APP_ONE_KEY 配置为模板复制 app_id/app_secret 等信息
INSERT INTO `pzds_user`.`app_social_details`
  (id, client_id, type, remark, app_id, app_secret, redirect_url, ext, create_by, update_by, create_time, update_time, del_flag)
SELECT
  (SELECT COALESCE(MAX(id), 0) FROM `pzds_user`.`app_social_details`) + t.seq,
  t.client_id,
  t.type,
  src.remark, src.app_id, src.app_secret, src.redirect_url, src.ext, src.create_by, src.update_by, NOW(), NOW(), src.del_flag
FROM (
  SELECT 'dianjing-ios'     AS client_id, 'ALI_APP_ONE_KEY' AS type, 1 AS seq
  UNION ALL SELECT 'dianjing-android', 'ALI_APP_ONE_KEY', 2
  UNION ALL SELECT 'dianjing-ios',     'ALI_H5_ONE_KEY',  3
  UNION ALL SELECT 'dianjing-android', 'ALI_H5_ONE_KEY',  4
) t
JOIN `pzds_user`.`app_social_details` src
  ON src.client_id = 'android' AND src.type = 'ALI_APP_ONE_KEY' AND src.del_flag = '0'
WHERE NOT EXISTS (
  SELECT 1 FROM `pzds_user`.`app_social_details`
  WHERE client_id = t.client_id AND type = t.type
);
