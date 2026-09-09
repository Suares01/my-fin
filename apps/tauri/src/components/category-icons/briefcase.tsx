import type { CategoryIconProps } from "./types"

export function Briefcase({
  size = 24,
  color = "currentColor",
  className,
  ...props
}: CategoryIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 25 24"
      fill="none"
      transform="rotate(0 0 0)"
      className={className}
      {...props}
    >
      <path
        d="M10.0234 3C8.7808 3 7.77344 4.00736 7.77344 5.25V6H4.77344C3.5308 6 2.52344 7.00736 2.52344 8.25V17.25C2.52344 18.4926 3.5308 19.5 4.77344 19.5H19.2736C20.5163 19.5 21.5236 18.4926 21.5236 17.25V8.25C21.5236 7.00736 20.5163 6 19.2736 6H16.2734V5.25C16.2734 4.00736 15.2661 3 14.0234 3H10.0234ZM14.7734 6V5.25C14.7734 4.83579 14.4377 4.5 14.0234 4.5H10.0234C9.60922 4.5 9.27344 4.83579 9.27344 5.25V6H14.7734ZM4.77344 7.5C4.35922 7.5 4.02344 7.83579 4.02344 8.25V17.25C4.02344 17.6642 4.35922 18 4.77344 18H19.2736C19.6879 18 20.0236 17.6642 20.0236 17.25V8.25C20.0236 7.83579 19.6879 7.5 19.2736 7.5H4.77344Z"
        fill={color}
        fillRule="evenodd"
        clipRule="evenodd"
      />
    </svg>
  )
}
