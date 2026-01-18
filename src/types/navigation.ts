import { StackNavigationProp } from '@react-navigation/stack';

export type RootStackParamList = {
  Auth: undefined;
  Map: { groupId?: string } | undefined;
  PlaceDetail: { placeId: string; groupId?: string };
  AddReview: { placeId: string; placeName: string; groupId?: string };
  PlacesList: { groupId?: string } | undefined;
  GroupsList: undefined;
  CreateGroup: undefined;
  JoinGroup: undefined;
  GroupDetail: { groupId: string };
};

export type MapScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Map'>;
export type PlaceDetailScreenNavigationProp = StackNavigationProp<RootStackParamList, 'PlaceDetail'>;
export type AddReviewScreenNavigationProp = StackNavigationProp<RootStackParamList, 'AddReview'>;
export type PlacesListScreenNavigationProp = StackNavigationProp<RootStackParamList, 'PlacesList'>;
export type GroupsListScreenNavigationProp = StackNavigationProp<RootStackParamList, 'GroupsList'>;
export type CreateGroupScreenNavigationProp = StackNavigationProp<RootStackParamList, 'CreateGroup'>;
export type JoinGroupScreenNavigationProp = StackNavigationProp<RootStackParamList, 'JoinGroup'>;
export type GroupDetailScreenNavigationProp = StackNavigationProp<RootStackParamList, 'GroupDetail'>;

