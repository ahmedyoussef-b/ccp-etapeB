import React from "react";
import Link from "next/link";

interface NexaFlowLogoProps {
  className?: string;
  iconClassName?: string;
  href?: string;
}

export function NexaFlowLogo({ className, iconClassName, href }: NexaFlowLogoProps) {
  const content = (
    <div className={`flex items-center justify-center rounded-lg bg-primary text-primary-foreground ${className || ""}`}>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={iconClassName || "h-4 w-4"}
      >
        <path d="M12 2L2 7l10 5 10-5-10-5z" />
        <path d="M2 17l10 5 10-5" />
        <path d="M2 12l10 5 10-5" />
      </svg>
    </div>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }

  return content;
}
