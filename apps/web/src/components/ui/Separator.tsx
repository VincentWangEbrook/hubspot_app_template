import React from "react";

interface SeparatorProps extends React.HTMLAttributes<HTMLHRElement> {}

export const Separator: React.FC<SeparatorProps> = ({ className = "", ...props }) => (
  <hr className={`border-gray-100 my-4 ${className}`} {...props} />
);
