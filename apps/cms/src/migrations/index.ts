import * as migration_20260830_122948 from './20260830_122948';
import * as migration_20260919_093340_drop_lead_activity from './20260919_093340_drop_lead_activity';

export const migrations = [
  {
    up: migration_20260830_122948.up,
    down: migration_20260830_122948.down,
    name: '20260830_122948',
  },
  {
    up: migration_20260919_093340_drop_lead_activity.up,
    down: migration_20260919_093340_drop_lead_activity.down,
    name: '20260919_093340_drop_lead_activity'
  },
];
