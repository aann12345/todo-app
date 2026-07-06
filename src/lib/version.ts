// Метка сборки — чтобы на любом устройстве было видно, какая версия запущена
export const BUILD_TIME = __BUILD_TIME__

export function versionLabel(): string {
  const d = new Date(BUILD_TIME)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `v${pad(d.getDate())}.${pad(d.getMonth() + 1)}-${pad(d.getHours())}:${pad(d.getMinutes())}`
}
