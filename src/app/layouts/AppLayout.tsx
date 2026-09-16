import styled from '@emotion/styled';
import { NavLink, Outlet, useNavigation } from 'react-router';
import { CalendarDays, Dumbbell, House, MoreHorizontal, TrendingUp } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { BarbellIcon, Toaster } from '@/components';

const BREAKPOINT = '1024px';

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Today', icon: House, end: true },
  { to: '/train', label: 'Train', icon: Dumbbell },
  { to: '/calendar', label: 'Calendar', icon: CalendarDays },
  { to: '/progress', label: 'Progress', icon: TrendingUp },
  { to: '/more', label: 'More', icon: MoreHorizontal },
];

const Shell = styled.div`
  min-height: 100dvh;
  display: flex;
  flex-direction: column;

  @media (min-width: ${BREAKPOINT}) {
    flex-direction: row;
  }
`;

const Main = styled.main`
  flex: 1;
  width: 100%;
  max-width: 72rem;
  margin: 0 auto;
  padding: ${({ theme }) => theme.space[4]};
  /* clear the iOS status bar when running as an installed standalone app */
  padding-top: calc(${({ theme }) => theme.space[4]} + env(safe-area-inset-top, 0px));
  /* keep content clear of the fixed bottom nav on mobile */
  padding-bottom: calc(${({ theme }) => theme.space[6]} + 64px + env(safe-area-inset-bottom, 0px));

  @media (min-width: ${BREAKPOINT}) {
    padding: ${({ theme }) => theme.space[6]};
  }
`;

/* Bottom nav: <1024px, 5 labeled items, active state, safe-area inset. */
const BottomNav = styled.nav`
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  background: ${({ theme }) => theme.colors.card};
  border-top: 1px solid ${({ theme }) => theme.colors.border};
  padding-bottom: env(safe-area-inset-bottom, 0px);
  z-index: 50;

  @media (min-width: ${BREAKPOINT}) {
    display: none;
  }
`;

/* Sidebar: ≥1024px. */
const Sidebar = styled.nav`
  display: none;

  @media (min-width: ${BREAKPOINT}) {
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.space[1]};
    width: 220px;
    flex-shrink: 0;
    padding: ${({ theme }) => theme.space[5]};
    border-right: 1px solid ${({ theme }) => theme.colors.border};
    background: ${({ theme }) => theme.colors.card};
    position: sticky;
    top: 0;
    height: 100dvh;
  }
`;

/* The icon inherits currentColor, so it tracks `primary` in both themes. */
const Brand = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.space[2]};
  font-family: ${({ theme }) => theme.typography.display};
  font-weight: 700;
  font-size: ${({ theme }) => theme.typography.fontSizes.lg};
  color: ${({ theme }) => theme.colors.primary};
  margin-bottom: ${({ theme }) => theme.space[5]};
`;

const navLinkStyles = `
  display: flex;
  align-items: center;
  text-decoration: none;
`;

const BottomLink = styled(NavLink)`
  ${navLinkStyles};
  flex-direction: column;
  justify-content: center;
  gap: 2px;
  min-height: 56px;
  padding: ${({ theme }) => theme.space[1]};
  font-size: ${({ theme }) => theme.typography.fontSizes.xs};
  font-weight: 500;
  color: ${({ theme }) => theme.colors.mutedForeground};

  &[aria-current='page'] {
    color: ${({ theme }) => theme.colors.primary};
    font-weight: 700;
  }
`;

const SideLink = styled(NavLink)`
  ${navLinkStyles};
  gap: ${({ theme }) => theme.space[3]};
  min-height: ${({ theme }) => theme.touchTarget};
  padding: ${({ theme }) => `${theme.space[2]} ${theme.space[3]}`};
  border-radius: ${({ theme }) => theme.radii.md};
  font-size: ${({ theme }) => theme.typography.fontSizes.md};
  font-weight: 500;
  color: ${({ theme }) => theme.colors.mutedForeground};

  &:hover {
    background: ${({ theme }) => theme.colors.muted};
  }

  &[aria-current='page'] {
    background: ${({ theme }) => theme.colors.muted};
    color: ${({ theme }) => theme.colors.primary};
    font-weight: 700;
  }
`;

/**
 * Thin progress bar while a lazy route chunk is in flight.
 *
 * Routes are lazy, so a tap on a page you have not opened yet has to fetch its
 * chunk before anything can change. A data router keeps the CURRENT page on
 * screen while that happens, which without this reads as a dead tap. It is
 * deliberately a bar rather than a skeleton over the destination: the old page
 * is still the true state until the new one is ready.
 *
 * Under prefers-reduced-motion it holds a static bar instead of sliding.
 */
const RouteProgress = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  z-index: 100;
  background: ${({ theme }) => theme.colors.primary};
  transform-origin: 0 50%;

  @media (prefers-reduced-motion: no-preference) {
    animation: routeProgressSlide 1.2s ease-in-out infinite;
  }

  @keyframes routeProgressSlide {
    0% {
      transform: scaleX(0.05);
      opacity: 0.6;
    }
    50% {
      transform: scaleX(0.7);
      opacity: 1;
    }
    100% {
      transform: scaleX(1);
      opacity: 0.6;
    }
  }
`;

/** Responsive shell: bottom nav <1024px, sidebar ≥1024px. */
export function AppLayout() {
  const navigating = useNavigation().state !== 'idle';
  return (
    <Shell>
      {navigating ? <RouteProgress role="status" aria-label="Loading page" /> : null}
      <Sidebar aria-label="Primary">
        <Brand>
          <BarbellIcon size={22} aria-hidden="true" />
          Fitness Track
        </Brand>
        {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
          <SideLink key={to} to={to} end={end}>
            <Icon size={20} aria-hidden="true" />
            {label}
          </SideLink>
        ))}
      </Sidebar>

      <Main>
        <Outlet />
      </Main>

      <BottomNav aria-label="Primary">
        {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
          <BottomLink key={to} to={to} end={end}>
            <Icon size={22} aria-hidden="true" />
            {label}
          </BottomLink>
        ))}
      </BottomNav>

      <Toaster />
    </Shell>
  );
}
