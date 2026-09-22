import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { api, type Season } from "../api/client.ts";
import { DesignationFields } from "../components/DesignationFields.tsx";
import { useSession } from "../hooks/useSession.tsx";

const thisYear = new Date().getFullYear();
const YEARS = Array.from({ length: 8 }, (_, i) => thisYear - i);
// most students start in the fall
const ENTRY_SEASONS: Season[] = ["Fall", "Winter", "Summer"];

export function SetupPage() {
  const { setStudent } = useSession();
  const navigate = useNavigate();
  const [season, setSeason] = useState<Season>("Fall");
  const [year, setYear] = useState(thisYear - 2);
  const [designations, setDesignations] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      setStudent(await api.createStudent({ program: { entry: { season, year } }, designations }));
      navigate("/transcript", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "couldn't create your profile");
      setSaving(false);
    }
  };

  const select = "rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/30";

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="text-2xl font-semibold text-slate-900">Set up your profile</h1>
      <p className="mt-2 text-slate-700">Your degree requirements come from the calendar of the year you started, so we need that first.</p>

      <form onSubmit={submit} className="mt-8 space-y-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <fieldset>
          <legend className="text-sm font-medium text-slate-800">When did you start the BCS program?</legend>
          <div className="mt-2 flex gap-3">
            <label className="sr-only" htmlFor="entry-season">
              Term
            </label>
            <select id="entry-season" className={select} value={season} onChange={(e) => setSeason(e.target.value as Season)}>
              {ENTRY_SEASONS.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
            <label className="sr-only" htmlFor="entry-year">
              Year
            </label>
            <select id="entry-year" className={select} value={year} onChange={(e) => setYear(Number(e.target.value))}>
              {YEARS.map((y) => (
                <option key={y}>{y}</option>
              ))}
            </select>
          </div>
          <p className="mt-2 text-xs text-slate-600">Your degree requirements come from the calendar of the year you entered.</p>
        </fieldset>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-slate-800">Are you aiming for any of these? (You can change this later.)</legend>
          <DesignationFields value={designations} onChange={setDesignations} />
        </fieldset>

        {error && (
          <p role="alert" className="text-sm text-red-700">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={saving}
          className="w-full rounded-md bg-teal-700 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-teal-800 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:ring-offset-2 disabled:opacity-60"
        >
          {saving ? "Setting up..." : "Continue"}
        </button>
      </form>
    </div>
  );
}
