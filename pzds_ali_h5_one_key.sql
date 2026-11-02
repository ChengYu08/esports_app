-- 添加一键登录的key

-- 1. 授权类型：iOS 和安卓都加上
UPDATE pzds_platform.sys_oauth_client_details
SET authorized_grant_types = CONCAT(authorized_grant_types, ',ali_h5_one_key,ali_app_one_key')
WHERE client_id = 'dianjing-ios';

UPDATE pzds_platform.sys_oauth_client_details
SET authorized_grant_types = CONCAT(authorized_grant_types, ',ali_h5_one_key,ali_app_one_key')
WHERE client_id = 'dianjing-android';

-- 2. 社交平台配置：以现有 android / ALI_APP_ONE_KEY 配置为模板复制 app_id/app_secret
--    先执行查询确认 id 不冲突，再执行插入
INSERT INTO pzds_user.app_social_details
  (id, client_id, type, remark, app_id, app_secret, redirect_url, ext, create_by, update_by, create_time, update_time, del_flag)
SELECT (SELECT COALESCE(MAX(id), 0) FROM pzds_user.app_social_details) + 1,
  'dianjing-ios', 'ALI_APP_ONE_KEY',
  remark, app_id, app_secret, redirect_url, ext, create_by, update_by, NOW(), NOW(), del_flag
FROM pzds_user.app_social_details
WHERE client_id = 'android' AND type = 'ALI_APP_ONE_KEY' AND del_flag = '0';

INSERT INTO pzds_user.app_social_details
  (id, client_id, type, remark, app_id, app_secret, redirect_url, ext, create_by, update_by, create_time, update_time, del_flag)
SELECT (SELECT COALESCE(MAX(id), 0) FROM pzds_user.app_social_details) + 1,
  'dianjing-android', 'ALI_APP_ONE_KEY',
  remark, app_id, app_secret, redirect_url, ext, create_by, update_by, NOW(), NOW(), del_flag
FROM pzds_user.app_social_details
WHERE client_id = 'android' AND type = 'ALI_APP_ONE_KEY' AND del_flag = '0';

INSERT INTO pzds_user.app_social_details
  (id, client_id, type, remark, app_id, app_secret, redirect_url, ext, create_by, update_by, create_time, update_time, del_flag)
SELECT (SELECT COALESCE(MAX(id), 0) FROM pzds_user.app_social_details) + 1,
  'dianjing-ios', 'ALI_H5_ONE_KEY',
  remark, app_id, app_secret, redirect_url, ext, create_by, update_by, NOW(), NOW(), del_flag
FROM pzds_user.app_social_details
WHERE client_id = 'android' AND type = 'ALI_APP_ONE_KEY' AND del_flag = '0';

INSERT INTO pzds_user.app_social_details
  (id, client_id, type, remark, app_id, app_secret, redirect_url, ext, create_by, update_by, create_time, update_time, del_flag)
SELECT (SELECT COALESCE(MAX(id), 0) FROM pzds_user.app_social_details) + 1,
  'dianjing-android', 'ALI_H5_ONE_KEY',
  remark, app_id, app_secret, redirect_url, ext, create_by, update_by, NOW(), NOW(), del_flag
FROM pzds_user.app_social_details
WHERE client_id = 'android' AND type = 'ALI_APP_ONE_KEY' AND del_flag = '0';
