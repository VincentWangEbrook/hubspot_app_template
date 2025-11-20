import React from "react";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className = "", ...props }, ref) => (
  <input
    ref={ref}
    className={`block w-full rounded-radius-md border border-gray-300 focus:ring-blue-600 focus:border-blue-600 px-3 py-2 text-base text-gray-900 placeholder:text-gray-500 disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
    {...props}
  />
));
Input.displayName = "Input";
