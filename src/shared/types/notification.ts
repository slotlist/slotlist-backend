/**
 * Notification indicating an application (created by the user) to a community has been accepted
 */
export const NOTIFICATION_TYPE_COMMUNITY_APPLICATION_ACCEPTED = 'community.application.accepted';
/**
 * Notification indicating an application to a community has been deleted by the user that created it
 */
export const NOTIFICATION_TYPE_COMMUNITY_APPLICATION_DELETED = 'community.application.deleted';
/**
 * Notification indicating an application (created by the user) to a community has been declined
 */
export const NOTIFICATION_TYPE_COMMUNITY_APPLICATION_DENIED = 'community.application.denied';
/**
 * Notification indicating a user's application (and thus the user as well) has been removed from a community
 */
export const NOTIFICATION_TYPE_COMMUNITY_APPLICATION_REMOVED = 'community.application.removed';
/**
 * Notification indicating a new application has been submitted to the community
 */
export const NOTIFICATION_TYPE_COMMUNITY_APPLICATION_NEW = 'community.application.new';
/**
 * Notification indicating a community has been deleted by its founder
 */
export const NOTIFICATION_TYPE_COMMUNITY_DELETED = 'community.deleted';
/**
 * Notification indicating a new community permission has been granted to the user
 */
export const NOTIFICATION_TYPE_COMMUNITY_PERMISSION_GRANTED = 'community.permission.granted';
/**
 * Notification indicating a community permission has been removed from the user
 */
export const NOTIFICATION_TYPE_COMMUNITY_PERMISSION_REVOKED = 'community.permission.revoked';
/**
 * Represents a generic notification, mainly used as a default for unknown entries
 */
export const NOTIFICATION_TYPE_GENERIC = 'generic';
/**
 * Notification indicating a mission has been deleted by the creator
 */
export const NOTIFICATION_TYPE_MISSION_DELETED = 'mission.deleted';
/**
 * Notification indicating a new mission permission has been granted to the user
 */
export const NOTIFICATION_TYPE_MISSION_PERMISSION_GRANTED = 'mission.permission.granted';
/**
 * Notification indicating a mission permission has been removed from the user
 */
export const NOTIFICATION_TYPE_MISSION_PERMISSION_REVOKED = 'mission.permission.revoked';
/**
 * Notification indicating a mission slot has been assigned to the user
 */
export const NOTIFICATION_TYPE_MISSION_SLOT_ASSIGNED = 'mission.slot.assigned';
/**
 * Notification indicating a new mission slot registration has been submitted
 */
export const NOTIFICATION_TYPE_MISSION_SLOT_REGISTRATION_NEW = 'mission.slot.registration.new';
/**
 * Notification indicating a mission slot has been unassigned from a user
 */
export const NOTIFICATION_TYPE_MISSION_SLOT_UNASSIGNED = 'mission.slot.unassigned';
/**
 * Notification indiciating a user has unregistered from a slot
 */
export const NOTIFICATION_TYPE_MISSION_SLOT_UNREGISTERED = 'mission.slot.unregistered';
/**
 * Notification indicating relevant parts of a mission (e.g. the mission times) have been updated
 */
export const NOTIFICATION_TYPE_MISSION_UPDATED = 'mission.updated';

/**
 * List of possible `notificationType` values, indicating the trigger of the notification
 */
export const NOTIFICATION_TYPES = [
    NOTIFICATION_TYPE_COMMUNITY_APPLICATION_ACCEPTED,
    NOTIFICATION_TYPE_COMMUNITY_APPLICATION_DELETED,
    NOTIFICATION_TYPE_COMMUNITY_APPLICATION_DENIED,
    NOTIFICATION_TYPE_COMMUNITY_APPLICATION_NEW,
    NOTIFICATION_TYPE_COMMUNITY_APPLICATION_REMOVED,
    NOTIFICATION_TYPE_COMMUNITY_DELETED,
    NOTIFICATION_TYPE_COMMUNITY_PERMISSION_GRANTED,
    NOTIFICATION_TYPE_COMMUNITY_PERMISSION_REVOKED,
    NOTIFICATION_TYPE_GENERIC,
    NOTIFICATION_TYPE_MISSION_DELETED,
    NOTIFICATION_TYPE_MISSION_PERMISSION_GRANTED,
    NOTIFICATION_TYPE_MISSION_PERMISSION_REVOKED,
    NOTIFICATION_TYPE_MISSION_SLOT_ASSIGNED,
    NOTIFICATION_TYPE_MISSION_SLOT_REGISTRATION_NEW,
    NOTIFICATION_TYPE_MISSION_SLOT_UNASSIGNED,
    NOTIFICATION_TYPE_MISSION_SLOT_UNREGISTERED,
    NOTIFICATION_TYPE_MISSION_UPDATED
];
