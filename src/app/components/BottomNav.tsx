"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import BottomNavigation from "@mui/material/BottomNavigation";
import BottomNavigationAction from "@mui/material/BottomNavigationAction";
import Paper from "@mui/material/Paper";
import SvgIcon from "@mui/material/SvgIcon";
import type { SvgIconProps } from "@mui/material/SvgIcon";

import {
  ACCOUNT_PATH,
  ANALYSIS_CHAT_PATH,
  ES_REVISION_PATH,
  EXPERIENCES_PATH,
  HOME_PATH,
} from "@/shared/routes";
import { CHAT_COLORS } from "@/shared/ui/chat-colors";

function HomeIcon(props: SvgIconProps) {
  return (
    <SvgIcon {...props}>
      <path d="M12 3.2 3 10.5V21h6v-6h6v6h6V10.5z" />
    </SvgIcon>
  );
}

function ChatIcon(props: SvgIconProps) {
  return (
    <SvgIcon {...props}>
      <path d="M4 4h16a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H9l-5 4v-4H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z" />
    </SvgIcon>
  );
}

function ReviewIcon(props: SvgIconProps) {
  return (
    <SvgIcon {...props}>
      <path d="M6 2h9l5 5v15H6zM14 2v6h6M8.5 12h7M8.5 15.5h7M8.5 18.5h4" />
    </SvgIcon>
  );
}

function CardsIcon(props: SvgIconProps) {
  return (
    <SvgIcon {...props}>
      <path d="M4 6h13v13H4zM7 3h13v13" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinejoin="round" />
    </SvgIcon>
  );
}

function UserIcon(props: SvgIconProps) {
  return (
    <SvgIcon {...props}>
      <path d="M12 12a4.25 4.25 0 1 0 0-8.5 4.25 4.25 0 0 0 0 8.5Zm0 2.1c-4.25 0-7.7 2.34-7.7 5.22V21h15.4v-1.68c0-2.88-3.45-5.22-7.7-5.22Z" />
    </SvgIcon>
  );
}

const NAV_ITEMS = [
  { label: "Home", href: HOME_PATH, icon: HomeIcon, tutorialId: undefined },
  // data-tutorial: 初回チュートリアルがChatタブをスポットライトで強調するための目印
  { label: "Chat", href: ANALYSIS_CHAT_PATH, icon: ChatIcon, tutorialId: "nav-chat-tab" },
  { label: "Cards", href: EXPERIENCES_PATH, icon: CardsIcon, tutorialId: undefined },
  { label: "Review", href: ES_REVISION_PATH, icon: ReviewIcon, tutorialId: undefined },
  { label: "User", href: ACCOUNT_PATH, icon: UserIcon, tutorialId: undefined },
] as const;

// アプリ共通の下部ナビゲーション。layout.tsxからだけ呼び出し、
// 各画面のpage.tsxからは意識しなくてよいようにする
export function BottomNav() {
  const pathname = usePathname();
  const activeHref =
    NAV_ITEMS.find((item) => item.href !== "/" && pathname?.startsWith(item.href))?.href ??
    (pathname === "/" ? "/" : false);

  return (
    <Paper
      square
      elevation={8}
      sx={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 1200,
        bgcolor: CHAT_COLORS.navy,
        borderTop: `1px solid ${CHAT_COLORS.navyBorder}`,
      }}
    >
      <BottomNavigation
        showLabels
        value={activeHref}
        sx={{
          bgcolor: CHAT_COLORS.navy,
          "& .MuiBottomNavigationAction-root": {
            color: CHAT_COLORS.textOnDarkMuted,
            minWidth: 64,
          },
          "& .Mui-selected": {
            color: CHAT_COLORS.orange,
          },
        }}
      >
        {NAV_ITEMS.map((item) => (
          <BottomNavigationAction
            key={item.href}
            component={Link}
            href={item.href}
            value={item.href}
            label={item.label}
            icon={<item.icon />}
            data-tutorial={item.tutorialId}
          />
        ))}
      </BottomNavigation>
    </Paper>
  );
}
