export function validateCredentials(username: string, password: string, setup: boolean): string {
  if (!username.trim()) return '请输入用户名。'
  if (!password) return '请输入密码。'
  if (setup && password.length < 12) return '管理员密码至少需要 12 个字符。'
  return ''
}
