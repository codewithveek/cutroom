import type React from "react";
import { Suspense } from "react";
import { LoginForm } from "@/features/auth/login-form";

export default function LoginPage(): React.ReactElement {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
