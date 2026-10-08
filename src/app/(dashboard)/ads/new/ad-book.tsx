"use client";

import { useRouter } from "next/navigation";
import { CheckIcon, Loader2Icon, StoreIcon } from "lucide-react";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/page-header";
import { SearchInput } from "@/components/common/search-input";
import { Section } from "@/components/common/section";
import { AsyncContent, ForbiddenState, LoadingState } from "@/components/common/states";
import { Thumb } from "@/components/common/thumb";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { NativeSelect } from "@/components/ui/native-select";
import { useApi } from "@/hooks/use-api";
import { ADS_PERMISSION, bookAd, listAdPlacements } from "@/lib/api/ads";
import { ApiError, errorMessage } from "@/lib/api/client";
import { listProducts } from "@/lib/api/products";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useAuth, useCan } from "@/store/auth";
import { AD_MAX_WEEKS, type AdPlacement, type AdPlacementKey } from "@/types/ads";
import { multiplyMoney } from "../_components/ad-labels";

export function AdBook() {
  const can = useCan();
  const allowed = can(ADS_PERMISSION);
  const { data, error, loading, reload } = useApi(allowed ? "ad-placements" : null, listAdPlacements);

  if (!allowed) return <ForbiddenState />;

  return (
    <>
      <PageHeader
        back={{ href: "/ads", label: "Ads" }}
        title="Book an ad"
        description="Choose where it shows, what it promotes and for how long. KACHI reviews it; once approved, you pay to start it."
      />
      <AsyncContent data={data} error={error} loading={loading} onRetry={reload}>
        {(placements) =>
          placements.length === 0 ? (
            <p className="rounded-xl bg-card p-5 text-sm text-muted-foreground ring-1 ring-foreground/10">
              No ad placements are on sale right now. Check again later.
            </p>
          ) : (
            <BookForm placements={placements} />
          )
        }
      </AsyncContent>
    </>
  );
}

interface Picked {
  id: string;
  name: string;
}

function BookForm({ placements }: { placements: AdPlacement[] }) {
  const router = useRouter();
  const suspended = useAuth((s) => s.user?.vendor?.status === "suspended");
  const [placement, setPlacement] = useState<AdPlacementKey>(placements[0].key);
  const [product, setProduct] = useState<Picked | null>(null);
  const [wholeStore, setWholeStore] = useState(false);
  const [weeks, setWeeks] = useState(1);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);

  const chosen = placements.find((p) => p.key === placement) ?? placements[0];
  const price = multiplyMoney(chosen.weekly_price, weeks);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!wholeStore && !product) {
      setErrors({ product_id: "Choose a product, or advertise the whole store." });
      return;
    }
    setErrors({});
    setPending(true);
    try {
      const ad = await bookAd({ placement, product_id: wholeStore ? null : (product?.id ?? null), weeks });
      toast.success(`Ad ${ad.number} booked. KACHI reviews it next.`);
      router.push(`/ads/${ad.id}`);
    } catch (error) {
      if (error instanceof ApiError && error.status === 422) {
        setErrors(Object.fromEntries(Object.entries(error.errors).map(([key, messages]) => [key, messages[0]])));
      } else {
        // 409: the store is closed or suspended.
        toast.error(errorMessage(error));
      }
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-6 lg:grid-cols-3" noValidate>
      <fieldset disabled={pending || suspended} className="grid h-fit gap-6 lg:col-span-2">
        <Section title="Placement">
          <div className="grid gap-3 sm:grid-cols-3">
            {placements.map((p) => (
              <Choice key={p.key} selected={p.key === placement} onSelect={() => setPlacement(p.key)}>
                <span className="font-medium">{p.name}</span>
                <span className="text-sm text-muted-foreground">{formatMoney(p.weekly_price)} a week</span>
              </Choice>
            ))}
          </div>
          {errors.placement && <ErrorText>{errors.placement}</ErrorText>}
        </Section>

        <Section title="What it promotes">
          <div className="grid gap-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Choice selected={!wholeStore} onSelect={() => setWholeStore(false)}>
                <span className="font-medium">One product</span>
                <span className="text-sm text-muted-foreground">{product ? product.name : "One of your live products."}</span>
              </Choice>
              <Choice selected={wholeStore} onSelect={() => setWholeStore(true)}>
                <span className="flex items-center gap-1.5 font-medium">
                  <StoreIcon className="size-4" /> Whole store
                </span>
                <span className="text-sm text-muted-foreground">Sends buyers to your store page.</span>
              </Choice>
            </div>
            {!wholeStore && <ProductPicker value={product} onChange={setProduct} />}
            {errors.product_id && <ErrorText>{errors.product_id}</ErrorText>}
          </div>
        </Section>

        <Section title="Duration">
          <Field label="Weeks" htmlFor="weeks" error={errors.weeks} hint="It starts as soon as your payment goes through.">
            <NativeSelect id="weeks" value={String(weeks)} onChange={(e) => setWeeks(Number(e.target.value))} className="w-full sm:w-44">
              {Array.from({ length: AD_MAX_WEEKS }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  {n} week{n === 1 ? "" : "s"}
                </option>
              ))}
            </NativeSelect>
          </Field>
        </Section>
      </fieldset>

      <Section title="Summary" className="h-fit">
        <dl className="grid gap-3 text-sm">
          <Row label="Placement">{chosen.name}</Row>
          <Row label="Promotes">{wholeStore ? "Whole store" : (product?.name ?? "—")}</Row>
          <Row label="Duration">
            {weeks} week{weeks === 1 ? "" : "s"} × {formatMoney(chosen.weekly_price)}
          </Row>
          <div className="flex items-baseline justify-between border-t pt-3">
            <dt className="font-medium">Price</dt>
            <dd className="font-heading text-headline-sm">{formatMoney(price)}</dd>
          </div>
        </dl>
        <Button type="submit" className="mt-5 w-full" disabled={pending || suspended}>
          {pending && <Loader2Icon className="animate-spin" />}
          Book the ad
        </Button>
        <p className="mt-2 text-xs text-muted-foreground">
          Nothing is charged now. You pay once KACHI approves it, before the time to pay runs out.
        </p>
      </Section>
    </form>
  );
}

function ProductPicker({ value, onChange }: { value: Picked | null; onChange: (product: Picked) => void }) {
  const [q, setQ] = useState("");
  const { data, error } = useApi(`ad-products:${q}`, () => listProducts({ status: "active", q, per_page: 8, sort: "name" }));

  return (
    <div className="grid gap-2">
      <SearchInput value={q} onChange={setQ} placeholder="Search your live products" className="sm:w-full" />
      <div className="max-h-72 overflow-y-auto rounded-lg ring-1 ring-foreground/10">
        {error ? (
          <p className="p-3 text-sm text-destructive">{errorMessage(error)}</p>
        ) : !data ? (
          <LoadingState />
        ) : data.data.length === 0 ? (
          <p className="p-3 text-sm text-muted-foreground">
            {q ? "No live product matches." : "You have no live products yet: only live products can be advertised."}
          </p>
        ) : (
          <ul className="divide-y">
            {data.data.map((product) => {
              const selected = value?.id === product.id;
              return (
                <li key={product.id}>
                  <button
                    type="button"
                    onClick={() => onChange({ id: product.id, name: product.name })}
                    aria-pressed={selected}
                    className={cn("flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-muted", selected && "bg-primary-fixed/60")}
                  >
                    <Thumb src={product.thumbnail_url} alt="" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{product.name}</span>
                      <span className="block text-xs text-muted-foreground">{product.sku}</span>
                    </span>
                    {selected && <CheckIcon className="size-4 text-primary" />}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function Choice({ selected, onSelect, children }: { selected: boolean; onSelect: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "grid gap-1 rounded-lg p-4 text-left ring-1 transition-colors disabled:opacity-60",
        selected ? "bg-primary-fixed/50 ring-primary" : "ring-foreground/10 hover:ring-foreground/25",
      )}
    >
      {children}
    </button>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right">{children}</dd>
    </div>
  );
}

function ErrorText({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="mt-2 text-xs text-destructive">
      {children}
    </p>
  );
}
