'use client';

import { useEffect, useState } from 'react';

export type ProfilePresentation = {
  fullName?: string;
  jobTitle?: string;
  avatarUrl?: string;
};

const profileUpdatedEvent = 'hutka:profile-updated';

export function publishProfilePresentation(profile: ProfilePresentation) {
  window.dispatchEvent(new CustomEvent<ProfilePresentation>(profileUpdatedEvent, { detail: profile }));
}

export function useProfilePresentation(initial: ProfilePresentation) {
  const { fullName, jobTitle, avatarUrl } = initial;
  const [profile, setProfile] = useState(initial);

  useEffect(() => {
    setProfile({ fullName, jobTitle, avatarUrl });
  }, [fullName, jobTitle, avatarUrl]);

  useEffect(() => {
    const update = (event: Event) => {
      const detail = (event as CustomEvent<ProfilePresentation>).detail;
      if (detail) setProfile(detail);
    };
    window.addEventListener(profileUpdatedEvent, update);
    return () => window.removeEventListener(profileUpdatedEvent, update);
  }, []);

  return profile;
}
