import { useState } from "react";
import { useNavigate } from "react-router";
import { BadgeCheck, ChevronDown, LogOut } from "lucide-react";
import { termLabel } from "backend/engine/terms";
import { api, type Student, type User } from "../api/client.ts";
import { useSession } from "../hooks/useSession.tsx";
import { DESIGNATIONS } from "./DesignationFields.tsx";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// the transcript prints "Lastname, Firstname Middle"
function firstName(name: string | null): string | null {
  return name?.split(",")[1]?.trim().split(/\s+/)[0] ?? null;
}

// The account, Honours and Cybersecurity choices (once there's a profile), and logging out.
export function ProfileMenu({ user, student }: { user: User; student: Student | null }) {
  const { setStudent, logout } = useSession();
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);

  const toggle = async (id: string, on: boolean) => {
    if (!student) return;
    setSaving(true);
    try {
      const designations = on ? [...student.designations, id] : student.designations.filter((d) => d !== id);
      setStudent(await api.updateDesignations(designations));
    } finally {
      setSaving(false);
    }
  };

  const logOut = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-9 gap-1.5 px-3">
          {firstName(user.name) ?? "Profile"}
          <ChevronDown className="text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel className="grid gap-0.5 font-normal">
          <span className="truncate font-medium">{user.name ?? user.email}</span>
          {user.name && <span className="truncate text-xs text-muted-foreground">{user.email}</span>}
          <span className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
            Student number {user.studentNumber}
            {user.verified && <BadgeCheck className="size-3.5 text-primary" aria-label="verified" />}
          </span>
          {!user.verified && <span className="text-xs text-muted-foreground">Import your transcript to verify it.</span>}
        </DropdownMenuLabel>
        {student && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">BCS, started {termLabel(student.program.entry)}</DropdownMenuLabel>
            {DESIGNATIONS.map((d) => (
              <DropdownMenuCheckboxItem
                key={d.id}
                checked={student.designations.includes(d.id)}
                disabled={saving}
                // keep the menu open while ticking both
                onSelect={(e) => e.preventDefault()}
                onCheckedChange={(on) => void toggle(d.id, on === true)}
              >
                {d.label}
              </DropdownMenuCheckboxItem>
            ))}
          </>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => void logOut()}>
          <LogOut />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
