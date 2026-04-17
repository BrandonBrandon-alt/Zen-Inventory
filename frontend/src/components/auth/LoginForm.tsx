"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Input, { PasswordInput } from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import { login } from "@/api/auth";

function EmailIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
      <polyline points="22,6 12,13 2,6"/>
    </svg>
  );
}

function LockIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
      <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
    </svg>
  );
}

interface FormState { email: string; password: string; }
interface FormErrors { email?: string; password?: string; }

function validate(v: FormState): FormErrors {
  const e: FormErrors = {};
  if (!v.email) e.email = "El correo es requerido.";
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email)) e.email = "Correo inválido.";
  if (!v.password) e.password = "La contraseña es requerida.";
  else if (v.password.length < 6) e.password = "Mínimo 6 caracteres.";
  return e;
}

export default function LoginForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [values, setValues] = useState<FormState>({ email: "", password: "" });
  const [errors, setErrors] = useState<FormErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const handleChange = (field: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = { ...values, [field]: e.target.value };
    setValues(next);
    if (touched[field]) setErrors(validate(next));
    setServerError(null);
  };

  const handleBlur = (field: keyof FormState) => () => {
    setTouched((t) => ({ ...t, [field]: true }));
    setErrors(validate(values));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched({ email: true, password: true });
    const errs = validate(values);
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    startTransition(async () => {
      try {
        await login({ email: values.email, password: values.password });
        router.push("/dashboard");
      } catch (err) {
        setServerError(err instanceof Error ? err.message : "Error inesperado.");
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} noValidate style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
      {serverError && (
        <div
          role="alert"
          style={{
            background: "rgba(248,113,113,0.08)",
            border: "1px solid rgba(248,113,113,0.25)",
            borderRadius: "var(--radius-md)",
            padding: "12px 16px",
            display: "flex",
            alignItems: "center",
            gap: "10px",
            color: "var(--color-danger)",
            fontSize: "13px",
            animation: "fadeInUp 0.2s ease",
          }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}>
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          {serverError}
        </div>
      )}

      <Input
        id="login-email"
        label="Correo electrónico"
        type="email"
        placeholder="admin@zeninventory.co"
        autoComplete="email"
        value={values.email}
        onChange={handleChange("email")}
        onBlur={handleBlur("email")}
        error={touched.email ? errors.email : undefined}
        icon={<EmailIcon />}
        disabled={isPending}
      />

      <PasswordInput
        id="login-password"
        label="Contraseña"
        placeholder="••••••••"
        autoComplete="current-password"
        value={values.password}
        onChange={handleChange("password")}
        onBlur={handleBlur("password")}
        error={touched.password ? errors.password : undefined}
        icon={<LockIcon />}
        disabled={isPending}
      />

      <Button
        type="submit"
        fullWidth
        size="lg"
        loading={isPending}
        style={{ marginTop: "6px" }}
      >
        {isPending ? "Verificando…" : "Ingresar al sistema"}
      </Button>
    </form>
  );
}
