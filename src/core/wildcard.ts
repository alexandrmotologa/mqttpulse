/**
 * MQTT Wildcard Topic Matcher & Validator
 * Compliant with OASIS MQTT v3.1.1 and v5.0 specifications.
 */

/**
 * Checks if a topic string is a valid topic filter (can contain + and #).
 */
export function isValidTopicFilter(filter: string): boolean {
  if (!filter || filter.length === 0) return false;

  const levels = filter.split('/');
  for (let i = 0; i < levels.length; i++) {
    const level = levels[i];

    // '#' must be alone in its level and must be the last level
    if (level.includes('#')) {
      if (level !== '#' || i !== levels.length - 1) {
        return false;
      }
    }

    // '+' must be alone in its level
    if (level.includes('+')) {
      if (level !== '+') {
        return false;
      }
    }
  }

  return true;
}

/**
 * Checks if a topic string is a valid topic name for publishing (cannot contain wildcards).
 */
export function isValidPublishTopic(topic: string): boolean {
  if (!topic || topic.length === 0) return false;
  return !topic.includes('+') && !topic.includes('#');
}

/**
 * Matches a concrete topic against an MQTT topic filter with support for '+' and '#'.
 * Handles leading '$' system topic restriction as per spec.
 */
export function matchesTopic(filter: string, topic: string): boolean {
  if (!filter || !topic) return false;
  if (filter === topic) return true;

  // Topics beginning with '$' (system topics) can only be matched if the filter also begins with '$'
  const isSystemTopic = topic.startsWith('$');
  const isSystemFilter = filter.startsWith('$');
  if (isSystemTopic !== isSystemFilter) {
    return false;
  }

  // Multi-level wildcard catch-all
  if (filter === '#') {
    return !isSystemTopic;
  }

  const filterLevels = filter.split('/');
  const topicLevels = topic.split('/');

  for (let i = 0; i < filterLevels.length; i++) {
    const fLevel = filterLevels[i];

    // Multi-level wildcard matches everything from here to end
    if (fLevel === '#') {
      return true;
    }

    // If topic has fewer levels than filter requires
    if (i >= topicLevels.length) {
      return false;
    }

    const tLevel = topicLevels[i];

    // Single-level wildcard matches any single level
    if (fLevel === '+') {
      continue;
    }

    // Exact level match
    if (fLevel !== tLevel) {
      return false;
    }
  }

  // If filter didn't end with '#', topic must have exactly the same number of levels
  return filterLevels.length === topicLevels.length;
}
