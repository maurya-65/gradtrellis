import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { api, type Season } from "../api/client.ts";
import { DesignationFields } from "../components/DesignationFields.tsx";
import { useSession } from "../hooks/useSession.tsx";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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

  return (
    <Card className="mx-auto max-w-xl">
      <CardHeader>
        <CardTitle className="text-xl">Set up your profile</CardTitle>
        <CardDescription>Your degree requirements come from the calendar of the year you started, so we need that first.</CardDescription>
      </CardHeader>
      <form onSubmit={submit}>
        <CardContent className="grid gap-8">
          <fieldset className="grid gap-3">
            <legend className="mb-3 text-sm font-medium">When did you start the BCS program?</legend>
            <div className="flex gap-3">
              <div className="grid gap-2">
                <Label htmlFor="entry-season" className="sr-only">
                  Term
                </Label>
                <Select value={season} onValueChange={(v) => setSeason(v as Season)}>
                  <SelectTrigger id="entry-season" className="h-10 w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ENTRY_SEASONS.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="entry-year" className="sr-only">
                  Year
                </Label>
                <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
                  <SelectTrigger id="entry-year" className="h-10 w-28">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {YEARS.map((y) => (
                      <SelectItem key={y} value={String(y)}>
                        {y}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </fieldset>

          <fieldset className="grid gap-3">
            <legend className="mb-3 text-sm font-medium">Aiming for any of these? You can change this later.</legend>
            <DesignationFields value={designations} onChange={setDesignations} />
          </fieldset>

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </CardContent>
        <CardFooter className="mt-6 border-t pt-6 pb-6">
          <Button type="submit" disabled={saving} className="h-10 w-full">
            {saving ? "Setting up..." : "Continue"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
