/**
 * Progress route: Charts / Body / Achievements sub-tabs, deep-linkable via
 * the `?tab=` search param (e.g. /progress?tab=achievements).
 */
import styled from '@emotion/styled';
import { useSearchParams } from 'react-router';
import { PageHeader, SegmentedTabs } from '@/components';
import { ChartsTab } from './ChartsTab';
import { BodyTab } from './BodyTab';
import { AchievementsTab } from './AchievementsTab';

const TABS = [
  { id: 'charts', label: 'Charts' },
  { id: 'body', label: 'Body' },
  { id: 'achievements', label: 'Achievements' },
] as const;

type TabId = (typeof TABS)[number]['id'];

function isTabId(v: string | null): v is TabId {
  return v === 'charts' || v === 'body' || v === 'achievements';
}

const Panel = styled.div`
  margin-top: ${({ theme }) => theme.space[4]};
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
      <PageHeader title="Progress" subtitle="Charts · Body · Achievements" />
      <SegmentedTabs tabs={[...TABS]} value={tab} onChange={setTab} aria-label="Progress sections" />
      <Panel role="tabpanel" id={`tabpanel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {tab === 'charts' ? <ChartsTab /> : tab === 'body' ? <BodyTab /> : <AchievementsTab />}
      </Panel>
    </>
  );
}

export default ProgressPage;
