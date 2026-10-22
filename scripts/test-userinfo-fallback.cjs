// Some restricted Windows runners return ENOMEM from uv_os_get_passwd even
// with ample memory. tsx only needs the username to choose a temp directory.
const os = require("node:os");
try {
  os.userInfo();
} catch (error) {
  if (error?.info?.code !== "ENOMEM") throw error;
  os.userInfo = () => ({
    username: process.env.USERNAME || process.env.USER || "joro-test",
    uid: -1,
    gid: -1,
    shell: null,
    homedir: os.homedir(),
  });
}
