import type { CategoryIconProps } from "./types"

export function Wallet({
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
        d="M5.75 3.25C4.50736 3.25 3.5 4.25736 3.5 5.5V18.5C3.5 19.7426 4.50736 20.75 5.75 20.75H18.75C19.9926 20.75 21 19.7426 21 18.5V9.5C21 8.25736 19.9926 7.25 18.75 7.25H18.5V5.5C18.5 4.25736 17.4926 3.25 16.25 3.25H5.75ZM17 7.25V5.5C17 5.08579 16.6642 4.75 16.25 4.75H5.75C5.33579 4.75 5 5.08579 5 5.5V7.25H17ZM5 8.75V18.5C5 18.9142 5.33579 19.25 5.75 19.25H18.75C19.1642 19.25 19.5 18.9142 19.5 18.5V9.5C19.5 9.08579 19.1642 8.75 18.75 8.75H5Z"
        fill={color}
        fillRule="evenodd"
        clipRule="evenodd"
      />
    </svg>
  )
}
