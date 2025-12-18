import React from "react";

interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {}

export const Label: React.FC<LabelProps> = ({ children, className = "", ...props }) => (
  <label className={`block text-gray-700 font-medium ${className}`} {...props}>
    {children}
  </label>
);
