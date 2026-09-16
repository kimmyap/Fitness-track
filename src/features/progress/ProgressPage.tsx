/**
 * Progress route: Charts / Body / Achievements sub-tabs, deep-linkable via
 * the `?tab=` search param (e.g. /progress?tab=achievements).
 */
import styled from '@emotion/styled';
import { useSearchParams } from 'react-router';
import { PageHeader, SegmentedTabs } from '@/components';
import { ChartsTab } from './ChartsTab';
import { PRsTab } from './PRsTab';
import { BodyTab } from './BodyTab';
import { AchievementsTab } from './AchievementsTab';
import { MetricsTab } from '@/features/metrics/MetricsTab';

const TABS = [
  { id: 'charts', label: 'Charts' },
  { id: 'prs', label: 'PRs' },
  { id: 'body', label: 'Body' },
  { id: 'daily', label: 'Daily' },
  { id: 'achievements', label: 'Achievements' },
] as const;

type TabId = (typeof TABS)[number]['id'];

function isTabId(v: string | null): v is TabId {
  return TABS.some((t) => t.id === v);
}

const Panel = styled.div`
  margin-top: ${({ theme }) => theme.space[4]};
`;

/* Five labels do not fit at 375px — scroll the strip itself, never the page.
   Same treatment TrainPage needed when it reached five tabs. */
const TabsScroller = styled.div`
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;

  > div {
    min-width: max-content;
  }
`;

export function ProgressPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const param = searchParams.get('tab');
  const tab: TabId = isTabId(param) ? param : 'charts';

  const setTab = (id: string) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set('tab', id);
        return next;
      },
      { replace: true },
    );
  };

  return (
    <>
      <PageHeader title="Progress" subtitle="Charts · PRs · Body · Daily · Achievements" />
      <TabsScroller>
        <SegmentedTabs tabs={[...TABS]} value={tab} onChange={setTab} aria-label="Progress sections" />
      </TabsScroller>
      <Panel role="tabpanel" id={`tabpanel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {tab === 'charts' ? (
          <ChartsTab />
        ) : tab === 'prs' ? (
          <PRsTab />
        ) : tab === 'body' ? (
          <BodyTab />
        ) : tab === 'daily' ? (
          <MetricsTab />
        ) : (
          <AchievementsTab />
        )}
      </Panel>
    </>
  );
}

export default ProgressPage;
