"use client";

import React from "react";
import { createPortal } from "react-dom";
import useSWR from "swr";
import { ClipboardCopy, Printer, Plus, Trash2, Check, Ship, Compass, LogIn, LogOut, ListTodo, PhoneCall, FileText, Mail, Repeat, Gift, MessageCircle, X, Send, Pencil } from "lucide-react";
import { getDailyTasks, getUpcomingDailyTasks, addDailyTask, toggleDailyTask, updateDailyTask, deleteDailyTask, getReminderChecks, setReminderCheck, getReminderDismissals, setReminderDismissed, type DailyTask } from "@/app/actions/komba";

export type ReminderItem = { id: string; text: string };
export type ReminderSection = { key: string; title: string; items: ReminderItem[] };

// Right-hand daily reminder next to the calendar. Auto sections (transports,
// excursions, arrivals, departures) are computed by the parent and passed in;
// manual tasks are stored in the shared DB so Slovenia + Madagascar see the same list.
export function DailyReminder({
  date,
  onDateChange,
  dateLabel,
  sections,
}: {
  date: string;
  onDateChange: (d: string) => void;
  dateLabel: string;
  sections: ReminderSection[];
}) {
  const { data: tasks, mutate } = useSWR(["daily-tasks", date], () => getDailyTasks(date), { refreshInterval: 0 });
  const { data: upcoming, mutate: mutateUpcoming } = useSWR(["daily-tasks-upcoming", date], () => getUpcomingDailyTasks(date), { refreshInterval: 0 });
  const { data: checks, mutate: mutateChecks } = useSWR(["reminder-checks", date], () => getReminderChecks(date), { refreshInterval: 0 });
  const { data: dismissals, mutate: mutateDismissals } = useSWR(["reminder-dismissals"], () => getReminderDismissals(), { refreshInterval: 0 });
  const [newTask, setNewTask] = React.useState("");
  const [newTaskDate, setNewTaskDate] = React.useState(date);
  const [newTaskAssignee, setNewTaskAssignee] = React.useState("");
  const [newTaskRecurring, setNewTaskRecurring] = React.useState(false);
  const [adding, setAdding] = React.useState(false);
  // Inline editing of an existing manual task
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editText, setEditText] = React.useState("");
  const [editAssignee, setEditAssignee] = React.useState("");
  const [editRecurring, setEditRecurring] = React.useState(false);
  const [savingEdit, setSavingEdit] = React.useState(false);
  // Two-step delete confirmation: first click arms, second click within a few seconds deletes
  const [confirmDeleteId, setConfirmDeleteId] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);
  const [addedElsewhere, setAddedElsewhere] = React.useState<string | null>(null);
  // WhatsApp preview modal (like sending a voucher — see the message before sending)
  const [waPreview, setWaPreview] = React.useState<{ title: string; blocks: { heading?: string; bungalow: string; rest: string; instruction: string }[]; body: string } | null>(null);
  // Multi-select: pick several reminders (across sections) and send them together
  const [selected, setSelected] = React.useState<Record<string, { section: string; text: string }>>({});

  // Keep the "new task date" in sync when the reminder day changes
  React.useEffect(() => { setNewTaskDate(date); }, [date]);
  // Clear the selection whenever the day changes (ids/items differ per day)
  React.useEffect(() => { setSelected({}); }, [date]);

  // Parse a reminder line "Bungalow · Guest · N os → instruction" into structured parts
  const parseBlock = (text: string) => {
    const [left, instruction] = text.split("→");
    const segs = left.split("·").map((x) => x.trim()).filter(Boolean);
    return { bungalow: segs[0] || "", rest: segs.slice(1).join(" · "), instruction: (instruction || "").trim() };
  };
  const toggleSelect = (id: string, section: string, text: string) =>
    setSelected((prev) => {
      const next = { ...prev };
      if (next[id]) delete next[id];
      else next[id] = { section, text };
      return next;
    });
  const selectedCount = Object.keys(selected).length;
  const openSelectedWaPreview = () => {
    // Group selected items by their section, in a stable order
    const bySection = new Map<string, string[]>();
    for (const { section, text } of Object.values(selected)) {
      if (!bySection.has(section)) bySection.set(section, []);
      bySection.get(section)!.push(text);
    }
    const title = "Izbrani opomniki";
    const blocks: { heading?: string; bungalow: string; rest: string; instruction: string }[] = [];
    for (const [section, texts] of bySection) {
      texts.forEach((text, i) => {
        blocks.push({ heading: i === 0 ? section : undefined, ...parseBlock(text) });
      });
    }
    // Build the sent body from the same blocks so preview and message match exactly
    const bodyBlocks = blocks
      .map((b) =>
        [b.heading ? `*${b.heading}*` : "", `*${b.bungalow}*`, b.rest, b.instruction ? `_${b.instruction}_` : ""]
          .filter(Boolean)
          .join("\n"),
      )
      .join("\n\n");
    const body = [`*${title}*`, dateLabel, "", bodyBlocks].join("\n");
    setWaPreview({ title, blocks, body });
  };

  // Who a task can be assigned to (Urška = zlata, Borut = moder, ostalo nevtralno)
  const ASSIGNEES: { value: string; label: string }[] = [
    { value: "", label: "Vsi / kdorkoli" },
    { value: "Urška", label: "Urška" },
    { value: "Borut", label: "Borut" },
  ];
  const assigneeTheme = (a: string | null) => {
    if (a === "Urška") return "border-[#c59b5b]/30 bg-[#c59b5b]/10 text-[#e8c88a]";
    if (a === "Borut") return "border-[#7fa8b8]/30 bg-[#7fa8b8]/10 text-[#daedf4]";
    return "border-white/15 bg-white/5 text-white/50";
  };

  const manual: DailyTask[] = tasks || [];
  const checkMap: Record<string, boolean> = checks || {};
  const dismissalMap: Record<string, string> = dismissals || {};

  // These auto reminders recur every day the guest is in-house (missing police data), so once
  // checked off they must stay resolved on the following days too — not just for the current day.
  const isPersistentKey = (checkKey: string) => checkKey.startsWith("policeEmail::");

  const handleToggleAuto = async (checkKey: string, done: boolean) => {
    // optimistic
    mutateChecks({ ...checkMap, [checkKey]: done }, { revalidate: false });
    if (isPersistentKey(checkKey)) {
      mutateDismissals(done ? { ...dismissalMap, [checkKey]: date } : Object.fromEntries(Object.entries(dismissalMap).filter(([k]) => k !== checkKey)), { revalidate: false });
    }
    await setReminderCheck(date, checkKey, done);
    if (isPersistentKey(checkKey)) await setReminderDismissed(checkKey, date, done);
    await Promise.all([mutateChecks(), mutateDismissals()]);
  };

  const handleAdd = async () => {
    const t = newTask.trim();
    if (!t) return;
    const targetDate = newTaskDate || date;
    setAdding(true);
    try {
      await addDailyTask(targetDate, t, newTaskAssignee || null, newTaskRecurring);
      setNewTask("");
      setNewTaskAssignee("");
      // Always refresh the "upcoming" list so a task added for a future day shows there immediately.
      await mutateUpcoming();
      // Recurring tasks show from their start date onward, so a recurring task added for
      // an earlier/other start date still appears today — refresh either way.
      if (targetDate === date || (newTaskRecurring && targetDate <= date)) {
        setAddedElsewhere(null);
        setNewTaskRecurring(false);
        await mutate();
      } else {
        // Task was added to a future day — confirm briefly; it also appears under "prihajajoča opravila"
        const d = new Date(targetDate + "T00:00:00Z");
        const label = isNaN(d.getTime()) ? targetDate : d.toLocaleDateString("sl-SI", { day: "numeric", month: "long" });
        setAddedElsewhere(label);
        setNewTaskRecurring(false);
        setTimeout(() => setAddedElsewhere(null), 4000);
      }
    } finally {
      setAdding(false);
    }
  };

  const handleToggle = async (id: string, done: boolean) => {
    await toggleDailyTask(id, done);
    await Promise.all([mutate(), mutateUpcoming()]);
  };

  const handleDelete = async (id: string) => {
    // First tap arms the confirmation; a second tap within 4s actually deletes.
    if (confirmDeleteId !== id) {
      setConfirmDeleteId(id);
      setTimeout(() => setConfirmDeleteId((cur) => (cur === id ? null : cur)), 4000);
      return;
    }
    setConfirmDeleteId(null);
    await deleteDailyTask(id);
    await Promise.all([mutate(), mutateUpcoming()]);
  };

  const startEdit = (t: DailyTask) => {
    setEditingId(t.id);
    setEditText(t.text);
    setEditAssignee(t.assignee || "");
    setEditRecurring(!!t.recurring);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditText("");
    setEditAssignee("");
    setEditRecurring(false);
  };

  const handleSaveEdit = async (id: string) => {
    const t = editText.trim();
    if (!t) return;
    setSavingEdit(true);
    try {
      await updateDailyTask(id, { text: t, assignee: editAssignee || null, recurring: editRecurring });
      cancelEdit();
      await Promise.all([mutate(), mutateUpcoming()]);
    } finally {
      setSavingEdit(false);
    }
  };

  // Build a plain-text version for WhatsApp / printing
  const buildText = () => {
    const lines: string[] = [];
    lines.push(`OPOMNIK - ${dateLabel}`);
    lines.push("");
    for (const s of visibleSections) {
      if (!s.items.length) continue;
      lines.push(`${s.title.toUpperCase()}:`);
      for (const it of s.items) lines.push(`- [${checkMap[it.id] ? "x" : " "}] ${it.text}`);
      lines.push("");
    }
    if (manual.length) {
      lines.push("OPRAVILA:");
      for (const t of manual) lines.push(`- [${t.done ? "x" : " "}] ${t.text}${t.assignee ? ` (${t.assignee})` : ""}${t.recurring ? " [vsak dan]" : ""}`);
      lines.push("");
    }
    return lines.join("\n").trim();
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(buildText());
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // ignore
    }
  };

  const handlePrint = () => {
    const text = buildText();
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    document.body.appendChild(iframe);
    const doc = iframe.contentWindow?.document;
    if (!doc) return;
    const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    doc.open();
    doc.write(
      `<html><head><title>Opomnik ${esc(dateLabel)}</title><style>body{font-family:system-ui,-apple-system,sans-serif;padding:28px;color:#10181b}h1{font-size:18px;margin:0 0 16px}pre{white-space:pre-wrap;font-family:inherit;font-size:13px;line-height:1.6;margin:0}</style></head><body><h1>Opomnik &middot; ${esc(dateLabel)}</h1><pre>${esc(text)}</pre></body></html>`
    );
    doc.close();
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
    setTimeout(() => document.body.removeChild(iframe), 1000);
  };

  const iconFor = (key: string) => {
    if (key === "orderAhead") return <PhoneCall className="h-3.5 w-3.5" />;
    if (key === "orderExcursionsAhead") return <Compass className="h-3.5 w-3.5" />;
    if (key === "prepareInvoice") return <FileText className="h-3.5 w-3.5" />;
    if (key === "prepareGift") return <Gift className="h-3.5 w-3.5" />;
    if (key === "policeEmail") return <Mail className="h-3.5 w-3.5" />;
    if (key === "transports") return <Ship className="h-3.5 w-3.5" />;
    if (key === "excursions") return <Compass className="h-3.5 w-3.5" />;
    if (key === "arrivals") return <LogIn className="h-3.5 w-3.5" />;
    if (key === "departures") return <LogOut className="h-3.5 w-3.5" />;
    return <ListTodo className="h-3.5 w-3.5" />;
  };

  // Hide persistent (police) reminders that were already checked off on an earlier day.
  // They stay visible on the day they were dismissed (so the check can be undone), but not after.
  const visibleSections = sections.map((s) => ({
    ...s,
    items: s.items.filter((it) => {
      if (!isPersistentKey(it.id)) return true;
      const dismissedOn = dismissalMap[it.id];
      return !dismissedOn || dismissedOn === date;
    }),
  }));

  const nonEmpty = visibleSections.filter((s) => s.items.length > 0);

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-[rgba(15,46,58,0.5)] p-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#c59b5b]">Dnevni opomnik</p>
          <h3 className="mt-1 text-base font-semibold text-white">Kaj je treba narediti</h3>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleCopy}
            className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-[11px] font-medium text-white/70 hover:bg-white/[0.08] hover:text-white transition-colors"
            title="Kopiraj za WhatsApp"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <ClipboardCopy className="h-3.5 w-3.5" />}
            <span>{copied ? "Kopirano" : "Kopiraj"}</span>
          </button>
          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-[11px] font-medium text-white/70 hover:bg-white/[0.08] hover:text-white transition-colors"
            title="Natisni"
          >
            <Printer className="h-3.5 w-3.5" />
            <span>Natisni</span>
          </button>
        </div>
      </div>

      {/* Date picker for the reminder */}
      <input
        type="date"
        value={date}
        onChange={(e) => onDateChange(e.target.value)}
        className="mt-3 w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white [color-scheme:dark] focus:border-[#c59b5b]/40 focus:outline-none"
      />
      <p className="mt-1.5 text-xs text-white/40">{dateLabel}</p>

      {/* Auto-generated sections */}
      <div className="mt-4 space-y-4">
        {nonEmpty.length === 0 ? (
          <p className="rounded-xl border border-white/5 bg-white/[0.02] px-3 py-3 text-xs text-white/40">
            Za ta dan ni samodejnih opravil (prevozi, izleti, prihodi, odhodi).
          </p>
        ) : (
          nonEmpty.map((s) => {
            // Urška (pripraviti račun) = zlata, Borut (naročiti prevoz) = moder, ostalo nevtralno
            const theme =
              s.key === "prepareInvoice" || s.key === "policeEmail"
                ? { wrap: "rounded-xl border border-[#c59b5b]/30 bg-[#c59b5b]/[0.06] p-2.5", header: "text-[#e8c88a]", icon: "text-[#e8c88a]", item: "border-[#c59b5b]/20 bg-[#c59b5b]/[0.04] text-[#e8c88a]/90", dot: "bg-[#e8c88a]" }
                : s.key === "orderAhead" || s.key === "orderExcursionsAhead" || s.key === "prepareGift"
                ? { wrap: "rounded-xl border border-[#7fa8b8]/30 bg-[#7fa8b8]/[0.08] p-2.5", header: "text-[#a8c6d2]", icon: "text-[#a8c6d2]", item: "border-[#7fa8b8]/20 bg-[#7fa8b8]/[0.06] text-[#daedf4]", dot: "bg-[#a8c6d2]" }
                : { wrap: "", header: "text-white/50", icon: "text-[#7fa8b8]", item: "border-white/5 bg-white/[0.02] text-white/70", dot: "bg-[#c59b5b]" };
            const isBorut = s.key === "orderAhead" || s.key === "orderExcursionsAhead" || s.key === "prepareGift";
            const openWaPreview = () => {
              const blocks = s.items.map((it) => {
                const [left, instruction] = it.text.split("→");
                const segs = left.split("·").map((x) => x.trim()).filter(Boolean);
                return { bungalow: segs[0] || "", rest: segs.slice(1).join(" · "), instruction: (instruction || "").trim() };
              });
              const body = [
                `*${s.title}*`,
                dateLabel,
                "",
                blocks
                  .map((b) => [`*${b.bungalow}*`, b.rest, b.instruction ? `_${b.instruction}_` : ""].filter(Boolean).join("\n"))
                  .join("\n\n"),
              ].join("\n");
              setWaPreview({ title: s.title, blocks, body });
            };
            return (
            <div key={s.key} className={theme.wrap}>
              <div className={`mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider ${theme.header}`}>
                <span className={theme.icon}>{iconFor(s.key)}</span>
                {s.title}
                <span className="rounded-full bg-white/5 px-1.5 text-[10px] text-white/40">{s.items.length}</span>
                {isBorut && (
                  <button
                    onClick={openWaPreview}
                    className="ml-auto inline-flex items-center gap-1 rounded-md border border-[#25D366]/40 bg-[#25D366]/15 px-2 py-1 text-[10px] font-medium normal-case tracking-normal text-[#8dbf92] transition-colors hover:bg-[#25D366]/25"
                    aria-label="Pošlji na WhatsApp"
                  >
                    <MessageCircle className="h-3 w-3" /> WhatsApp
                  </button>
                )}
              </div>
              <ul className="space-y-1">
                {s.items.map((it) => {
                  const done = !!checkMap[it.id];
                  const picked = !!selected[it.id];
                  return (
                  <li key={it.id} className={`flex items-start gap-2.5 rounded-lg border px-2.5 py-2 text-xs ${picked ? "border-[#25D366]/40 bg-[#25D366]/[0.07]" : done ? "border-emerald-400/20 bg-emerald-400/[0.04]" : theme.item}`}>
                    <button
                      onClick={() => handleToggleAuto(it.id, !done)}
                      className={`mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md border transition-colors ${done ? "border-emerald-400/50 bg-emerald-400/25 text-emerald-200" : "border-white/25 text-transparent hover:border-white/50"}`}
                      aria-label={done ? "Označi kot nedokončano" : "Označi kot dokončano"}
                    >
                      <Check className="h-3.5 w-3.5" />
                    </button>
                    <span className={`min-w-0 flex-1 text-pretty ${done ? "text-white/30 line-through" : ""}`}>{it.text}</span>
                    <button
                      onClick={() => toggleSelect(it.id, s.title, it.text)}
                      className={`mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border transition-colors ${picked ? "border-[#25D366]/60 bg-[#25D366]/30 text-[#8dbf92]" : "border-white/20 text-transparent hover:border-[#25D366]/50"}`}
                      aria-label={picked ? "Odstrani iz izbire za WhatsApp" : "Izberi za WhatsApp"}
                      title="Izberi za WhatsApp"
                    >
                      <MessageCircle className="h-3 w-3" />
                    </button>
                  </li>
                  );
                })}
              </ul>
            </div>
            );
          })
        )}
      </div>

      {/* Manual tasks */}
      <div className="mt-5 border-t border-white/5 pt-4">
        <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-white/50">
          <ListTodo className="h-3.5 w-3.5 text-[#8fae92]" />
          Moja opravila
          {manual.length > 0 && <span className="rounded-full bg-white/5 px-1.5 text-[10px] text-white/40">{manual.length}</span>}
          {manual.length > 0 && (
            <button
              onClick={() => {
                const blocks = manual.map((t) => ({ bungalow: t.text, rest: t.assignee || "", instruction: "" }));
                const body = [
                  "*Moja opravila*",
                  dateLabel,
                  "",
                  blocks.map((b) => [`*${b.bungalow}*`, b.rest].filter(Boolean).join("\n")).join("\n\n"),
                ].join("\n");
                setWaPreview({ title: "Moja opravila", blocks, body });
              }}
              className="ml-auto inline-flex items-center gap-1 rounded-md border border-[#25D366]/40 bg-[#25D366]/15 px-2 py-1 text-[10px] font-medium normal-case tracking-normal text-[#8dbf92] transition-colors hover:bg-[#25D366]/25"
              aria-label="Pošlji na WhatsApp"
            >
              <MessageCircle className="h-3 w-3" /> WhatsApp
            </button>
          )}
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={newTask}
            onChange={(e) => setNewTask(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing && (e as unknown as { keyCode: number }).keyCode !== 229) handleAdd(); }}
            placeholder="Dodaj opravilo..."
            className="min-w-0 flex-1 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-[#8fae92]/40 focus:outline-none"
          />
          <button
            onClick={handleAdd}
            disabled={adding || !newTask.trim()}
            className="inline-flex items-center justify-center rounded-lg border border-[#8fae92]/20 bg-[#8fae92]/10 px-3 text-[#8fae92] hover:bg-[#8fae92]/20 disabled:opacity-40 transition-colors"
            aria-label="Dodaj opravilo"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>

        {/* Date + assignee for the new task */}
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <label className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="text-[10px] uppercase tracking-wider text-white/40">Datum</span>
            <input
              type="date"
              value={newTaskDate}
              onChange={(e) => setNewTaskDate(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-xs text-white [color-scheme:dark] focus:border-[#8fae92]/40 focus:outline-none"
            />
          </label>
          <label className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="text-[10px] uppercase tracking-wider text-white/40">Za koga</span>
            <select
              value={newTaskAssignee}
              onChange={(e) => setNewTaskAssignee(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-xs text-white [color-scheme:dark] focus:border-[#8fae92]/40 focus:outline-none"
            >
              {ASSIGNEES.map((a) => (
                <option key={a.value} value={a.value} className="bg-[#0f2e3a] text-white">{a.label}</option>
              ))}
            </select>
          </label>
        </div>
        <label className="mt-2 flex cursor-pointer items-center gap-2 text-xs text-white/60">
          <button
            type="button"
            onClick={() => setNewTaskRecurring((v) => !v)}
            className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md border transition-colors ${newTaskRecurring ? "border-[#8fae92]/50 bg-[#8fae92]/25 text-[#8fae92]" : "border-white/25 text-transparent hover:border-white/50"}`}
            aria-label="Ponavljaj vsak dan"
            aria-pressed={newTaskRecurring}
          >
            <Check className="h-3.5 w-3.5" />
          </button>
          <span className="inline-flex items-center gap-1"><Repeat className="h-3.5 w-3.5 text-white/40" /> Ponavljaj vsak dan (dokler ni narejeno)</span>
        </label>
        {addedElsewhere && (
          <p className="mt-2 rounded-lg border border-[#8fae92]/20 bg-[#8fae92]/10 px-2.5 py-1.5 text-[11px] text-[#8fae92]">
            Opravilo dodano za {addedElsewhere}. Izberi ta dan, da ga vidiš.
          </p>
        )}

        <ul className="mt-2 space-y-1">
          {manual.map((t) => {
            if (editingId === t.id) {
              return (
                <li key={t.id} className="rounded-lg border border-[#8fae92]/30 bg-[#8fae92]/[0.05] px-2.5 py-2">
                  <input
                    type="text"
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing && (e as unknown as { keyCode: number }).keyCode !== 229) handleSaveEdit(t.id); if (e.key === "Escape") cancelEdit(); }}
                    autoFocus
                    className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-[#8fae92]/40 focus:outline-none"
                  />
                  <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                    <label className="flex min-w-0 flex-1 flex-col gap-1">
                      <span className="text-[10px] uppercase tracking-wider text-white/40">Za koga</span>
                      <select
                        value={editAssignee}
                        onChange={(e) => setEditAssignee(e.target.value)}
                        className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-xs text-white [color-scheme:dark] focus:border-[#8fae92]/40 focus:outline-none"
                      >
                        {ASSIGNEES.map((a) => (
                          <option key={a.value} value={a.value} className="bg-[#0f2e3a] text-white">{a.label}</option>
                        ))}
                      </select>
                    </label>
                    <label className="flex flex-1 cursor-pointer items-center gap-2 text-xs text-white/60 sm:pt-4">
                      <button
                        type="button"
                        onClick={() => setEditRecurring((v) => !v)}
                        className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md border transition-colors ${editRecurring ? "border-[#8fae92]/50 bg-[#8fae92]/25 text-[#8fae92]" : "border-white/25 text-transparent hover:border-white/50"}`}
                        aria-pressed={editRecurring}
                        aria-label="Ponavljaj vsak dan"
                      >
                        <Check className="h-3.5 w-3.5" />
                      </button>
                      <span className="inline-flex items-center gap-1"><Repeat className="h-3.5 w-3.5 text-white/40" /> Vsak dan</span>
                    </label>
                  </div>
                  <div className="mt-2 flex gap-2">
                    <button
                      onClick={() => handleSaveEdit(t.id)}
                      disabled={savingEdit || !editText.trim()}
                      className="flex-1 rounded-lg border border-[#8fae92]/30 bg-[#8fae92]/15 px-3 py-1.5 text-xs font-medium text-[#8fae92] hover:bg-[#8fae92]/25 disabled:opacity-40"
                    >
                      Shrani
                    </button>
                    <button
                      onClick={cancelEdit}
                      className="flex-1 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-white/70 hover:bg-white/[0.06]"
                    >
                      Prekliči
                    </button>
                  </div>
                </li>
              );
            }
            return (
            <li key={t.id} className="flex items-center gap-2 rounded-lg border border-white/5 bg-white/[0.02] px-2.5 py-1.5">
              <button
                onClick={() => handleToggle(t.id, !t.done)}
                className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md border ${t.done ? "border-emerald-400/50 bg-emerald-400/25 text-emerald-200" : "border-white/25 text-transparent hover:border-white/50"}`}
                aria-label={t.done ? "Ozna\u010di kot nedokon\u010dano" : "Ozna\u010di kot dokon\u010dano"}
              >
                <Check className="h-3.5 w-3.5" />
              </button>
              <span className={`min-w-0 flex-1 text-xs ${t.done ? "text-white/30 line-through" : "text-white/80"}`}>{t.text}</span>
              {t.recurring && (
                <span className="flex flex-shrink-0 items-center gap-0.5 rounded-full border border-[#8fae92]/30 bg-[#8fae92]/10 px-1.5 py-0.5 text-[10px] font-medium text-[#8fae92]" title="Ponavlja se vsak dan, dokler ni narejeno">
                  <Repeat className="h-2.5 w-2.5" /> vsak dan
                </span>
              )}
              {t.assignee && (
                <span className={`flex-shrink-0 rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${assigneeTheme(t.assignee)}`}>{t.assignee}</span>
              )}
              <button
                onClick={() => toggleSelect(`manual::${t.id}`, "Moja opravila", t.assignee ? `${t.text} · ${t.assignee}` : t.text)}
                className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border transition-colors ${selected[`manual::${t.id}`] ? "border-[#25D366]/60 bg-[#25D366]/30 text-[#8dbf92]" : "border-white/20 text-transparent hover:border-[#25D366]/50"}`}
                aria-label={selected[`manual::${t.id}`] ? "Odstrani iz izbire za WhatsApp" : "Izberi za WhatsApp"}
                title="Izberi za WhatsApp"
              >
                <MessageCircle className="h-3 w-3" />
              </button>
              <button
                onClick={() => startEdit(t)}
                className="flex-shrink-0 text-white/30 hover:text-[#8fae92] transition-colors"
                aria-label="Uredi opravilo"
                title="Uredi"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              {confirmDeleteId === t.id ? (
                <button
                  onClick={() => handleDelete(t.id)}
                  className="flex-shrink-0 rounded-full border border-red-400/40 bg-red-500/15 px-2 py-0.5 text-[10px] font-semibold text-red-300 hover:bg-red-500/25 transition-colors"
                  aria-label="Potrdi brisanje opravila"
                  title="Klikni ponovno za brisanje"
                >
                  Izbriši?
                </button>
              ) : (
                <button
                  onClick={() => handleDelete(t.id)}
                  className="flex-shrink-0 text-white/30 hover:text-red-400 transition-colors"
                  aria-label="Izbriši opravilo"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </li>
            );
          })}
        </ul>
      </div>

      {(upcoming || []).length > 0 && (
        <div className="mt-5">
          <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-[#c59b5b]">
            <ListTodo className="h-3.5 w-3.5" /> Prihajajoča opravila
          </div>
          <ul className="space-y-1">
            {(upcoming || []).map((t) => {
              const d = new Date(t.date + "T00:00:00Z");
              const dayLabel = isNaN(d.getTime()) ? t.date : d.toLocaleDateString("sl-SI", { weekday: "short", day: "numeric", month: "long" });
              return (
                <li key={t.id} className="flex items-center gap-2 rounded-lg border border-[#c59b5b]/15 bg-[#c59b5b]/[0.04] px-2.5 py-1.5">
                  <button
                    onClick={() => onDateChange(t.date)}
                    className="flex-shrink-0 rounded-full border border-[#c59b5b]/30 bg-[#c59b5b]/10 px-2 py-0.5 text-[10px] font-medium text-[#c59b5b] hover:bg-[#c59b5b]/20"
                    title="Odpri ta dan"
                  >
                    {dayLabel}
                  </button>
                  <span className="min-w-0 flex-1 text-xs text-white/80">{t.text}</span>
                  {t.assignee && (
                    <span className={`flex-shrink-0 rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${assigneeTheme(t.assignee)}`}>{t.assignee}</span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {selectedCount > 0 && !waPreview && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-x-0 bottom-0 z-[90] flex justify-center px-4 pb-4">
          <div className="flex w-full max-w-md items-center gap-2 rounded-2xl border border-[#25D366]/40 bg-[#0f2e3a]/95 px-3 py-2.5 shadow-2xl backdrop-blur">
            <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-[#25D366]/20 text-[13px] font-semibold text-[#8dbf92]">{selectedCount}</span>
            <span className="min-w-0 flex-1 truncate text-xs text-white/70">izbranih za pošiljanje</span>
            <button
              onClick={() => setSelected({})}
              className="flex-shrink-0 rounded-lg border border-white/10 px-2.5 py-1.5 text-xs text-white/60 hover:bg-white/[0.06]"
            >
              Počisti
            </button>
            <button
              onClick={openSelectedWaPreview}
              className="flex flex-shrink-0 items-center gap-1.5 rounded-lg border border-[#25D366]/40 bg-[#25D366]/20 px-3 py-1.5 text-xs font-medium text-[#8dbf92] hover:bg-[#25D366]/30"
            >
              <MessageCircle className="h-3.5 w-3.5" /> Pošlji izbrane
            </button>
          </div>
        </div>,
        document.body,
      )}

      {waPreview && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4" onClick={() => setWaPreview(null)}>
          <div className="flex max-h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-t-2xl border border-white/10 bg-[#0f2e3a] shadow-2xl sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center gap-2 border-b border-white/10 bg-[#12232a] px-4 py-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#25D366]/15 text-[#8dbf92]"><MessageCircle className="h-4 w-4" /></span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-white">Predogled WhatsApp sporočila</p>
                <p className="truncate text-[11px] text-white/40">Preverite besedilo pred pošiljanjem</p>
              </div>
              <button onClick={() => setWaPreview(null)} className="rounded-md p-1 text-white/50 hover:bg-white/10 hover:text-white" aria-label="Zapri"><X className="h-4 w-4" /></button>
            </div>

            {/* WhatsApp-style chat area */}
            <div className="flex-1 overflow-y-auto bg-[#0b141a] px-3 py-4" style={{ backgroundImage: "radial-gradient(circle at 20% 20%, rgba(255,255,255,0.02) 0, transparent 40%)" }}>
              <div className="ml-auto max-w-[85%] rounded-xl rounded-tr-sm bg-[#005c4b] px-3 py-2 text-[13px] leading-relaxed text-white shadow">
                <p className="font-bold text-white">{waPreview.title}</p>
                <p className="mb-2 text-[12px] text-white/70">{dateLabel}</p>
                <div className="space-y-2.5">
                  {waPreview.blocks.map((b, i) => (
                    <div key={i}>
                      {b.heading && <p className="mb-0.5 mt-1 font-bold uppercase tracking-wide text-[#a6ccaa]">{b.heading}</p>}
                      <p className="font-semibold text-white">{b.bungalow}</p>
                      {b.rest && <p className="text-white/85">{b.rest}</p>}
                      {b.instruction && <p className="italic text-[#c9f0dd]">{b.instruction}</p>}
                    </div>
                  ))}
                </div>
                <p className="mt-1 text-right text-[10px] text-white/45">
                  {new Date().toLocaleTimeString("sl-SI", { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            </div>

            {/* Footer actions */}
            <div className="flex gap-2 border-t border-white/10 bg-[#12232a] px-4 py-3">
              <button
                onClick={() => setWaPreview(null)}
                className="flex-1 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white/70 hover:bg-white/[0.06]"
              >
                Prekliči
              </button>
              <button
                onClick={() => {
                  window.open(`https://wa.me/?text=${encodeURIComponent(waPreview.body)}`, "_blank", "noopener,noreferrer");
                  setWaPreview(null);
                }}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-[#25D366]/40 bg-[#25D366]/20 px-3 py-2 text-sm font-medium text-[#8dbf92] hover:bg-[#25D366]/30"
              >
                <Send className="h-4 w-4" /> Pošlji na WhatsApp
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
