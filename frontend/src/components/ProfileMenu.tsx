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
        <Button variant="ghost" size="icon" className="group size-9 rounded-full" aria-label="Your profile">
          <CircleUserRound className="size-7 text-muted-foreground transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-12" strokeWidth={1.5} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="grid gap-0.5 font-normal">
          <span className="truncate font-medium">{user.name}</span>
          <span className="truncate text-xs text-muted-foreground">{user.email}</span>
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
