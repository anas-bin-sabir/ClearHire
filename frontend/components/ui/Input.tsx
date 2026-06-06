import React from "react";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  helperText?: string;
  error?: string;
  icon?: React.ReactNode;
}

export default function Input({
  label,
  helperText,
  error,
  icon,
  className = "",
  id,
  ...props
}: InputProps) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");

  return (
    <div className="space-y-1.5">
      {label && (
        <label htmlFor={inputId} className="block text-sm font-medium text-foreground">
          {label}
        </label>
      )}
      <div className="relative">
        {icon && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none">
            {icon}
          </span>
        )}
        <input
          id={inputId}
          className={[
            "w-full rounded-lg border bg-card text-foreground text-sm",
            "placeholder:text-muted/60",
            "border-border focus:border-primary/50 focus:ring-2 focus:ring-ring/20",
            "transition-colors duration-150",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            icon ? "pl-9 pr-3 py-2.5" : "px-3 py-2.5",
            error ? "border-danger focus:border-danger/50 focus:ring-danger/20" : "",
            className,
          ].join(" ")}
          aria-invalid={!!error}
          aria-describedby={error ? `${inputId}-error` : helperText ? `${inputId}-helper` : undefined}
          {...props}
        />
      </div>
      {helperText && !error && (
        <p id={`${inputId}-helper`} className="text-xs text-muted">
          {helperText}
        </p>
      )}
      {error && (
        <p id={`${inputId}-error`} className="text-xs text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
