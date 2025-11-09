"use client";

import { useState, MouseEvent } from "react";
import { signOut } from "next-auth/react";

import { cn } from "@/lib/utils";

interface SignOutButtonProps {
  className?: string;
}

export const SignOutButton = ({ className }: SignOutButtonProps) => {
  const [isLoading, setIsLoading] = useState(false);

  const handleClick = async (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();

    if (isLoading) {
      return;
    }

    try {
      setIsLoading(true);
      await signOut({
        callbackUrl: "/login",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isLoading}
      className={cn(
        "rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-70",
        className,
      )}
    >
      {isLoading ? "로그아웃 중..." : "로그아웃"}
    </button>
  );
};


