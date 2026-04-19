import * as React from "react"

export function Button({ children, className = "", variant = "default", size = "default", disabled, onClick, type = "button", ...props }) {
  const base = "inline-flex items-center justify-center rounded-md font-medium transition-colors focus:outline-none disabled:opacity-50 disabled:pointer-events-none"
  const variants = {
    default: "bg-blue-600 text-white hover:bg-blue-700",
    outline: "border border-gray-300 bg-transparent hover:bg-gray-100",
    ghost: "bg-transparent hover:bg-gray-100",
  }
  const sizes = {
    default: "h-10 py-2 px-4 text-sm",
    sm: "h-8 px-3 text-xs",
    lg: "h-12 px-6 text-base",
    icon: "h-10 w-10",
  }
  return (
    <button
      type={type}
      className={`${base} ${variants[variant] || variants.default} ${sizes[size] || sizes.default} ${className}`}
      disabled={disabled}
      onClick={onClick}
      {...props}
    >
      {children}
    </button>
  )
}
