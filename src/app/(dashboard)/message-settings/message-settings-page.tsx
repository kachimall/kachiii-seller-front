"use client";

import { Loader2Icon, PlusIcon, Trash2Icon } from "lucide-react";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/page-header";
import { Section } from "@/components/common/section";
import { AsyncContent, ForbiddenState } from "@/components/common/states";
import { StatusBadge } from "@/components/common/status-badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useApi } from "@/hooks/use-api";
import { ApiError, errorMessage } from "@/lib/api/client";
import { getMessageSettings, MESSAGE_SETTINGS_PERMISSION, updateMessageSettings } from "@/lib/api/messages";
import { cn } from "@/lib/utils";
import { useAuth, useCan } from "@/store/auth";
import {
  AUTO_REPLY_MAX,
  QUICK_REPLIES_MAX,
  WEEKDAYS,
  type MessageSettings,
  type MessageSettingsInput,
  type OpeningHours,
} from "@/types/messages";

export function MessageSettingsPage() {
  const can = useCan();
  const allowed = can(MESSAGE_SETTINGS_PERMISSION);
  const { data, error, loading, reload, mutate } = useApi(allowed ? "message-settings" : null, getMessageSettings);

  if (!allowed) return <ForbiddenState />;

  return (
    <>
      <PageHeader
        title="Message settings"
        description="Automatic replies, the hours you answer buyers, and the answers you keep at hand while writing."
      />
      <AsyncContent data={data} error={error} loading={loading} onRetry={reload}>
        {(settings) => <SettingsForm key={JSON.stringify(settings)} settings={settings} onSaved={mutate} />}
      </AsyncContent>
    </>
  );
}

interface DayRow {
  open: boolean;
  opens: string;
  closes: string;
}

type Errors = Record<string, string>;

function toDays(hours: OpeningHours[] | null): DayRow[] {
  return WEEKDAYS.map(({ day }) => {
    const found = hours?.find((h) => h.day === day);
    return found ? { open: true, opens: found.opens, closes: found.closes } : { open: false, opens: "09:00", closes: "18:00" };
  });
}

function SettingsForm({ settings, onSaved }: { settings: MessageSettings; onSaved: (settings: MessageSettings) => void }) {
  const suspended = useAuth((s) => s.user?.vendor?.status === "suspended");
  const [welcome, setWelcome] = useState(settings.welcome_message ?? "");
  const [welcomeOn, setWelcomeOn] = useState(settings.welcome_message_enabled);
  const [away, setAway] = useState(settings.away_message ?? "");
  const [awayOn, setAwayOn] = useState(settings.away_message_enabled);
  const [alwaysOpen, setAlwaysOpen] = useState(settings.opening_hours === null);
  const [days, setDays] = useState<DayRow[]>(() => toDays(settings.opening_hours));
  const [quick, setQuick] = useState<string[]>(settings.quick_replies);
  const [errors, setErrors] = useState<Errors>({});
  const [pending, setPending] = useState(false);

  const openDays = days
    .map((row, i) => ({ ...row, day: WEEKDAYS[i].day }))
    .filter((row) => row.open)
    .map(({ day, opens, closes }) => ({ day, opens, closes }));

  async function save(event: React.FormEvent) {
    event.preventDefault();
    const local: Errors = {};
    if (welcomeOn && !welcome.trim()) local.welcome_message_enabled = "Write the welcome reply before switching it on.";
    if (awayOn && !away.trim()) local.away_message_enabled = "Write the away reply before switching it on.";
    days.forEach((row, i) => {
      if (row.open && row.closes <= row.opens) local[`day.${i}`] = "Close after it opens.";
    });
    if (quick.some((q) => !q.trim())) local.quick_replies = "Fill in or remove the empty quick replies.";
    setErrors(local);
    if (Object.keys(local).length > 0) return;

    const body: MessageSettingsInput = {
      welcome_message: welcome.trim() || null,
      welcome_message_enabled: welcomeOn,
      away_message: away.trim() || null,
      away_message_enabled: awayOn,
      opening_hours: alwaysOpen ? null : openDays,
      quick_replies: quick.map((q) => q.trim()),
    };

    setPending(true);
    try {
      onSaved(await updateMessageSettings(body));
      toast.success("Message settings saved.");
    } catch (error) {
      if (error instanceof ApiError && error.status === 422) {
        setErrors(serverErrors(error, openDays));
        toast.error(errorMessage(error));
      } else {
        toast.error(errorMessage(error));
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={save} className="grid gap-6" noValidate>
      <fieldset disabled={pending || suspended} className="grid gap-6">
        <Section title="Automatic replies">
          <div className="grid gap-6">
            <AutoReply
              id="welcome"
              title="Welcome reply"
              description="Sent by itself to a buyer's first message while you are open."
              text={welcome}
              onText={setWelcome}
              on={welcomeOn}
              onToggle={setWelcomeOn}
              error={errors.welcome_message ?? errors.welcome_message_enabled}
            />
            <AutoReply
              id="away"
              title="Away reply"
              description="Sent by itself, at most once a day in a conversation, to messages outside your opening hours."
              text={away}
              onText={setAway}
              on={awayOn}
              onToggle={setAwayOn}
              error={errors.away_message ?? errors.away_message_enabled}
            />
          </div>
        </Section>

        <Section
          title="Opening hours"
          actions={
            <StatusBadge
              status={settings.open_now ? "active" : "inactive"}
              label={settings.open_now ? "Open now" : "Away now"}
            />
          }
        >
          <div className="grid gap-4">
            <p className="text-sm text-muted-foreground">
              UAE time. Outside these hours, the away reply answers buyers (when it is on).
            </p>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={alwaysOpen} onCheckedChange={(checked) => setAlwaysOpen(checked === true)} />
              Always open
            </label>
            {!alwaysOpen && (
              <div className="grid gap-2">
                {WEEKDAYS.map(({ day, label }, i) => {
                  const row = days[i];
                  const update = (patch: Partial<DayRow>) =>
                    setDays((prev) => prev.map((r, j) => (j === i ? { ...r, ...patch } : r)));
                  const error = errors[`day.${i}`];
                  return (
                    <div key={day} className="grid gap-1">
                      <div className="flex flex-wrap items-center gap-3">
                        <label className="flex w-36 items-center gap-2 text-sm">
                          <Checkbox checked={row.open} onCheckedChange={(checked) => update({ open: checked === true })} />
                          {label}
                        </label>
                        {row.open ? (
                          <span className="flex items-center gap-2 text-sm">
                            <Input
                              type="time"
                              aria-label={`${label} opens`}
                              value={row.opens}
                              onChange={(e) => update({ opens: e.target.value })}
                              className="w-32"
                              aria-invalid={Boolean(error)}
                            />
                            to
                            <Input
                              type="time"
                              aria-label={`${label} closes`}
                              value={row.closes}
                              onChange={(e) => update({ closes: e.target.value })}
                              className="w-32"
                              aria-invalid={Boolean(error)}
                            />
                          </span>
                        ) : (
                          <span className="text-sm text-muted-foreground">Closed</span>
                        )}
                      </div>
                      {error && (
                        <p role="alert" className="text-xs text-destructive sm:pl-39">
                          {error}
                        </p>
                      )}
                    </div>
                  );
                })}
                {openDays.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    No day open: every message gets the away reply (when it is on).
                  </p>
                )}
                {errors.opening_hours && <FieldError>{errors.opening_hours}</FieldError>}
              </div>
            )}
          </div>
        </Section>

        <Section
          title="Quick replies"
          actions={
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={quick.length >= QUICK_REPLIES_MAX}
              onClick={() => setQuick((prev) => [...prev, ""])}
            >
              <PlusIcon /> Add
            </Button>
          }
        >
          <div className="grid gap-3">
            <p className="text-sm text-muted-foreground">
              Up to {QUICK_REPLIES_MAX} answers you can insert while writing to a buyer.
            </p>
            {quick.length === 0 && <p className="text-sm text-muted-foreground">No quick replies yet.</p>}
            {quick.map((text, i) => (
              <div key={i} className="flex items-start gap-2">
                <Textarea
                  aria-label={`Quick reply ${i + 1}`}
                  value={text}
                  rows={2}
                  maxLength={AUTO_REPLY_MAX}
                  onChange={(e) => setQuick((prev) => prev.map((q, j) => (j === i ? e.target.value : q)))}
                  aria-invalid={Boolean(errors[`quick_replies.${i}`])}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove quick reply ${i + 1}`}
                  onClick={() => setQuick((prev) => prev.filter((_, j) => j !== i))}
                >
                  <Trash2Icon />
                </Button>
              </div>
            ))}
            {(errors.quick_replies || Object.keys(errors).some((k) => k.startsWith("quick_replies."))) && (
              <FieldError>
                {errors.quick_replies ?? Object.entries(errors).find(([k]) => k.startsWith("quick_replies."))?.[1]}
              </FieldError>
            )}
          </div>
        </Section>
      </fieldset>

      <div className="flex justify-end">
        <Button type="submit" disabled={pending || suspended}>
          {pending && <Loader2Icon className="animate-spin" />}
          Save settings
        </Button>
      </div>
    </form>
  );
}

function AutoReply({
  id,
  title,
  description,
  text,
  onText,
  on,
  onToggle,
  error,
}: {
  id: string;
  title: string;
  description: string;
  text: string;
  onText: (text: string) => void;
  on: boolean;
  onToggle: (on: boolean) => void;
  error?: string;
}) {
  return (
    <div className="grid gap-2">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Label htmlFor={`${id}-text`}>{title}</Label>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <span className="flex items-center gap-2 text-sm">
          <span className={cn(!on && "text-muted-foreground")}>{on ? "On" : "Off"}</span>
          <Switch checked={on} onCheckedChange={onToggle} aria-label={`${title} on`} />
        </span>
      </div>
      <Textarea
        id={`${id}-text`}
        value={text}
        rows={3}
        maxLength={AUTO_REPLY_MAX}
        onChange={(e) => onText(e.target.value)}
        aria-invalid={Boolean(error)}
        placeholder={on ? undefined : "Kept while the reply is off."}
      />
      <div className="flex justify-between gap-2">
        {error ? <FieldError>{error}</FieldError> : <span />}
        <span className="text-xs text-muted-foreground">
          {text.trim().length}/{AUTO_REPLY_MAX}
        </span>
      </div>
    </div>
  );
}

function FieldError({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="text-xs text-destructive">
      {children}
    </p>
  );
}

/** 422 keys to the form: opening_hours.N.* point at the Nth day sent, which maps back to a weekday row. */
function serverErrors(error: ApiError, sent: OpeningHours[]): Errors {
  const out: Errors = {};
  for (const [key, messages] of Object.entries(error.errors)) {
    const hours = /^opening_hours\.(\d+)\./.exec(key);
    if (hours) {
      const day = sent[Number(hours[1])]?.day;
      const row = WEEKDAYS.findIndex((d) => d.day === day);
      out[row >= 0 ? `day.${row}` : "opening_hours"] ??= messages[0];
    } else {
      out[key] ??= messages[0];
    }
  }
  return out;
}
