import React from "react";

type CardVariant = "default" | "elevated" | "primary" | "success" | "danger";

interface CardProps {
  children: React.ReactNode;
  variant?: CardVariant;
  className?: string;
  hover?: boolean;
  padding?: "none" | "sm" | "md" | "lg";
  onClick?: () => void;
}

const variantClasses: Record<CardVariant, string> = {
  default:  "bg-card shadow-sm",
  elevated: "bg-card-elevated shadow-md",
  primary:  "bg-card shadow-sm border border-primary/20",
  success:  "bg-card shadow-sm border border-success/20",
  danger:   "bg-card shadow-sm border border-danger/20",
};

const paddingClasses = {
  none: "",
  sm:   "p-4",
  md:   "p-5",
  lg:   "p-6",
};

export default function Card({
  children,
  variant = "default",
  className = "",
  hover = false,
  padding = "md",
  onClick,
}: CardProps) {
  return (
    <div
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={onClick ? (e) => e.key === "Enter" && onClick() : undefined}
      className={[
        "rounded-xl transition-all duration-200",
        variantClasses[variant],
        paddingClasses[padding],
        hover && "hover:shadow-md hover:-translate-y-0.5 cursor-default",
        className,
      ].filter(Boolean).join(" ")}
    >
      {children}
    </div>
  );
}
