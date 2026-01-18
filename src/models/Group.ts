import { User } from './User';

export interface Group {
  id: string;
  name: string;
  created_at: string;
  updated_at?: string;
}

export interface GroupMember {
  id: string;
  group_id: string;
  user_id: string;
  role: 'owner' | 'member';
  joined_at: string;
}

export interface GroupWithMembers extends Group {
  members?: User[];
}

