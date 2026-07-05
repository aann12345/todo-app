import type { Profile } from '../types'

export default function Avatar({
  profile,
  size = 24,
}: {
  profile: Pick<Profile, 'display_name' | 'color'>
  size?: number
}) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white select-none"
      style={{
        width: size,
        height: size,
        backgroundColor: profile.color,
        fontSize: size * 0.5,
      }}
      title={profile.display_name}
    >
      {profile.display_name.charAt(0).toUpperCase()}
    </span>
  )
}
