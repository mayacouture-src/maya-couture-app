"use client";

import { Copy, KeyRound } from "lucide-react";
import Link from "next/link";
import { useActionState, useState } from "react";
import { Button, LinkButton } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldGrid, FormSection } from "@/components/ui/section";
import type { Permission } from "@/lib/permissions";
import { PermissionsPicker } from "./permissions-picker";
import type { CreateUserState, UpdateUserState } from "./actions";

type Mode = "create" | "edit";

type Props =
  | {
      mode: "create";
      action: (state: CreateUserState, formData: FormData) => Promise<CreateUserState>;
    }
  | {
      mode: "edit";
      isSelf: boolean;
      defaultValues: {
        email: string;
        name: string;
        role: "ADMIN" | "STAFF";
        status: "ACTIVE" | "DISABLED";
        permissions: Permission[];
      };
      action: (state: UpdateUserState, formData: FormData) => Promise<UpdateUserState>;
    };

export function UserForm(props: Props) {
  if (props.mode === "create") return <CreateForm action={props.action} />;
  return <EditForm {...props} />;
}

function CreateForm({
  action
}: {
  action: (state: CreateUserState, formData: FormData) => Promise<CreateUserState>;
}) {
  const [state, formAction, pending] = useActionState<CreateUserState, FormData>(
    action,
    { kind: "idle" }
  );
  const [role, setRole] = useState<"ADMIN" | "STAFF">("STAFF");

  if (state.kind === "created") {
    return <CreatedBanner email={state.email} password={state.password} />;
  }

  const submitted = state.kind === "error" ? state.values : undefined;
  const attempt = state.kind === "error" ? state.attempt ?? 0 : 0;

  return (
    <form action={formAction} className="space-y-10">
      <IdentityFields submitted={submitted} attempt={attempt} />
      <RoleField value={role} onChange={setRole} />

      {role === "STAFF" && (
        <FormSection
          title="Permissions"
          description="Coche ce que la vendeuse a le droit de faire. Les ADMIN ont tout par défaut."
        >
          <PermissionsPicker defaultSelected={[]} />
        </FormSection>
      )}

      <PasswordHint mode="create" />

      <FormError state={state} />

      <FormFooter pending={pending} submitLabel="Créer le compte" />
    </form>
  );
}

function EditForm({
  defaultValues,
  isSelf,
  action
}: Extract<Props, { mode: "edit" }>) {
  const [state, formAction, pending] = useActionState<UpdateUserState, FormData>(
    action,
    { kind: "idle" }
  );
  const [role, setRole] = useState<"ADMIN" | "STAFF">(defaultValues.role);

  const submitted = state.kind === "error" ? state.values : undefined;
  const attempt = state.kind === "error" ? state.attempt ?? 0 : 0;

  return (
    <form action={formAction} className="space-y-10">
      <IdentityFields defaultValues={defaultValues} submitted={submitted} attempt={attempt} />
      <RoleField value={role} onChange={setRole} disabled={isSelf} disabledReason={isSelf ? "Vous ne pouvez pas changer votre propre rôle." : undefined} />

      <FormSection title="Statut" description="Un compte désactivé ne peut plus se connecter.">
        <div className="flex gap-2">
          <RadioCard
            name="status"
            value="ACTIVE"
            label="Actif"
            description="Peut se connecter"
            defaultChecked={defaultValues.status === "ACTIVE"}
            disabled={isSelf}
          />
          <RadioCard
            name="status"
            value="DISABLED"
            label="Désactivé"
            description="Connexion bloquée"
            defaultChecked={defaultValues.status === "DISABLED"}
            disabled={isSelf}
          />
        </div>
        {isSelf && (
          <p className="text-xs text-zinc-400">
            Vous ne pouvez pas désactiver votre propre compte.
          </p>
        )}
      </FormSection>

      {role === "STAFF" && (
        <FormSection
          title="Permissions"
          description="Coche ce que la vendeuse a le droit de faire."
        >
          <PermissionsPicker defaultSelected={defaultValues.permissions} />
        </FormSection>
      )}

      <FormError state={state} />
      {state.kind === "saved" && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          Modifications enregistrées.
        </div>
      )}

      <FormFooter pending={pending} submitLabel="Enregistrer" />
    </form>
  );
}

function IdentityFields({
  defaultValues,
  submitted,
  attempt
}: {
  defaultValues?: { email: string; name: string };
  submitted?: Record<string, string>;
  attempt?: number;
}) {
  const v = (key: string, fallback?: string) =>
    submitted ? (submitted[key] ?? "") : (fallback ?? "");
  return (
    <FormSection title="Identité" description="Le nom apparaît dans les en-têtes de documents.">
      <FieldGrid cols={2} key={attempt ?? 0}>
        <div className="space-y-1.5">
          <Label htmlFor="name" required>
            Nom complet
          </Label>
          <Input
            id="name"
            name="name"
            required
            defaultValue={v("name", defaultValues?.name)}
            placeholder="Maya Bensalem"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email" required>
            Email
          </Label>
          <Input
            id="email"
            name="email"
            type="email"
            required
            defaultValue={v("email", defaultValues?.email)}
            placeholder="vendeuse@maya-couture.fr"
          />
        </div>
      </FieldGrid>
    </FormSection>
  );
}

function RoleField({
  value,
  onChange,
  disabled,
  disabledReason
}: {
  value: "ADMIN" | "STAFF";
  onChange: (v: "ADMIN" | "STAFF") => void;
  disabled?: boolean;
  disabledReason?: string;
}) {
  return (
    <FormSection
      title="Rôle"
      description="Les ADMIN ont accès à tout. Les vendeuses n'ont accès qu'aux permissions cochées."
    >
      <div className="flex gap-2">
        <RadioCard
          name="role"
          value="ADMIN"
          label="Gérante"
          description="Toutes les permissions"
          checked={value === "ADMIN"}
          onChange={() => onChange("ADMIN")}
          disabled={disabled}
        />
        <RadioCard
          name="role"
          value="STAFF"
          label="Vendeuse"
          description="Permissions à choisir"
          checked={value === "STAFF"}
          onChange={() => onChange("STAFF")}
          disabled={disabled}
        />
      </div>
      {disabledReason && <p className="text-xs text-zinc-400">{disabledReason}</p>}
    </FormSection>
  );
}

function RadioCard({
  name,
  value,
  label,
  description,
  defaultChecked,
  checked,
  onChange,
  disabled
}: {
  name: string;
  value: string;
  label: string;
  description?: string;
  defaultChecked?: boolean;
  checked?: boolean;
  onChange?: () => void;
  disabled?: boolean;
}) {
  return (
    <label
      className={
        "flex flex-1 cursor-pointer flex-col gap-0.5 rounded-xl border border-zinc-200 bg-white px-4 py-3 transition has-[:checked]:border-brand-400 has-[:checked]:bg-brand-50/60 " +
        (disabled ? "cursor-not-allowed opacity-60" : "hover:border-zinc-300")
      }
    >
      <input
        type="radio"
        name={name}
        value={value}
        defaultChecked={defaultChecked}
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        className="sr-only"
      />
      <span className="text-sm font-semibold text-zinc-900">{label}</span>
      {description && <span className="text-xs text-zinc-500">{description}</span>}
    </label>
  );
}

function PasswordHint({ mode }: { mode: Mode }) {
  if (mode !== "create") return null;
  return (
    <div className="flex items-start gap-3 rounded-xl border border-zinc-200/70 bg-zinc-50/70 px-4 py-3 text-sm text-zinc-600">
      <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-zinc-400" />
      <p>
        Un mot de passe sera <strong>généré automatiquement</strong> à la création — copie-le et
        transmets-le à la personne. Elle pourra le changer ensuite via{" "}
        <Link href="/me" className="font-medium text-brand-700 hover:underline">
          Mes paramètres
        </Link>
        .
      </p>
    </div>
  );
}

function FormError({ state }: { state: { kind: string; error?: string } }) {
  if (state.kind !== "error" || !state.error) return null;
  return (
    <div
      role="alert"
      className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
    >
      {state.error}
    </div>
  );
}

function FormFooter({ pending, submitLabel }: { pending: boolean; submitLabel: string }) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-3 border-t border-zinc-200/70 pt-6">
      <LinkButton href="/users" variant="ghost">
        Annuler
      </LinkButton>
      <Button type="submit" disabled={pending}>
        {pending ? "Enregistrement…" : submitLabel}
      </Button>
    </div>
  );
}

function CreatedBanner({ email, password }: { email: string; password: string }) {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6">
        <p className="font-serif text-lg text-emerald-900">Compte créé</p>
        <p className="mt-1 text-sm text-emerald-700">
          Note ou copie ces identifiants — le mot de passe ne sera plus affiché ensuite.
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <CopyField label="Email" value={email} />
          <CopyField label="Mot de passe temporaire" value={password} mono />
        </div>
        <p className="mt-4 text-xs text-emerald-700">
          La personne pourra le changer dès sa première connexion via « Mes paramètres ».
        </p>
      </div>
      <div className="flex items-center justify-end gap-3">
        <LinkButton href="/users" variant="ghost">
          Retour à l&apos;équipe
        </LinkButton>
        <LinkButton href="/users/new">Créer un autre compte</LinkButton>
      </div>
    </div>
  );
}

function CopyField({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="space-y-1.5">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700">
        {label}
      </p>
      <div className="flex items-center gap-2">
        <code
          className={
            "flex-1 truncate rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm text-zinc-900 " +
            (mono ? "font-mono" : "")
          }
        >
          {value}
        </code>
        <button
          type="button"
          onClick={() => {
            navigator.clipboard.writeText(value).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            });
          }}
          className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-white px-3 py-2 text-xs font-medium text-emerald-700 hover:bg-emerald-50"
        >
          <Copy className="h-3.5 w-3.5" />
          {copied ? "Copié" : "Copier"}
        </button>
      </div>
    </div>
  );
}
