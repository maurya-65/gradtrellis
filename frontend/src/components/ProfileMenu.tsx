import { Link, useNavigate } from "react-router";
import { CircleUserRound, LogOut, Settings } from "lucide-react";
import type { User } from "../api/client.ts";
import { useSession } from "../hooks/useSession.tsx";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// The transcript prints "Lastname, Firstname Middle"; unverified accounts have no name yet.
export function displayName(user: User): string | null {
  if (!user.name) return null;
  const [last, first] = user.name.split(",").map((s) => s.trim());
  return first ? `${first} ${last}` : user.name;
}

export function ProfileMenu({ user }: { user: User }) {
  const { logout } = useSession();
  const navigate = useNavigate();

  const logOut = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="size-9 rounded-full" aria-label="Your profile">
          <CircleUserRound className="size-7 text-muted-foreground" strokeWidth={1.5} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="grid gap-0.5 font-normal">
          <span className="truncate font-medium">{displayName(user) ?? user.email}</span>
          {user.name && <span className="truncate text-xs text-muted-foreground">{user.email}</span>}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/profile">
            <Settings />
            Profile and settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void logOut()}>
          <LogOut />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
