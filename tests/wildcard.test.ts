import { describe, it, expect } from 'vitest';
import { matchesTopic, isValidTopicFilter, isValidPublishTopic } from '../src/core/wildcard.js';

describe('MQTT Topic Wildcard Matcher', () => {
  it('validates topic filters correctly', () => {
    expect(isValidTopicFilter('sensors/+/temperature')).toBe(true);
    expect(isValidTopicFilter('sensors/#')).toBe(true);
    expect(isValidTopicFilter('#')).toBe(true);
    expect(isValidTopicFilter('+')).toBe(true);
    expect(isValidTopicFilter('sensors/temp#')).toBe(false); // # must be alone in level
    expect(isValidTopicFilter('sensors/#/more')).toBe(false); // # must be last level
    expect(isValidTopicFilter('sensors/+temp')).toBe(false); // + must be alone
    expect(isValidTopicFilter('')).toBe(false);
  });

  it('validates publish topic names correctly', () => {
    expect(isValidPublishTopic('factory/line1/sensor')).toBe(true);
    expect(isValidPublishTopic('sensors/+/temperature')).toBe(false);
    expect(isValidPublishTopic('sensors/#')).toBe(false);
    expect(isValidPublishTopic('')).toBe(false);
  });

  it('matches exact topic matches', () => {
    expect(matchesTopic('a/b/c', 'a/b/c')).toBe(true);
    expect(matchesTopic('a/b/c', 'a/b/d')).toBe(false);
    expect(matchesTopic('a/b', 'a/b/c')).toBe(false);
  });

  it('matches single-level wildcard (+)', () => {
    expect(matchesTopic('sport/+/player1', 'sport/tennis/player1')).toBe(true);
    expect(matchesTopic('sport/+/player1', 'sport/football/player1')).toBe(true);
    expect(matchesTopic('sport/+/player1', 'sport/tennis/wimbledon/player1')).toBe(false);
    expect(matchesTopic('+/#', 'sport/tennis/player1')).toBe(true);
    expect(matchesTopic('+/+', 'sport/tennis')).toBe(true);
    expect(matchesTopic('+/+', 'sport/tennis/player1')).toBe(false);
  });

  it('matches multi-level wildcard (#)', () => {
    expect(matchesTopic('sport/tennis/#', 'sport/tennis')).toBe(true);
    expect(matchesTopic('sport/tennis/#', 'sport/tennis/player1')).toBe(true);
    expect(matchesTopic('sport/tennis/#', 'sport/tennis/player1/ranking')).toBe(true);
    expect(matchesTopic('sport/tennis/#', 'sport/football')).toBe(false);
    expect(matchesTopic('#', 'any/topic/name')).toBe(true);
  });

  it('respects system topic ($) restrictions', () => {
    expect(matchesTopic('#', '$SYS/broker/version')).toBe(false);
    expect(matchesTopic('+/topic', '$SYS/topic')).toBe(false);
    expect(matchesTopic('$SYS/#', '$SYS/broker/version')).toBe(true);
    expect(matchesTopic('$SYS/broker/+', '$SYS/broker/version')).toBe(true);
  });
});
