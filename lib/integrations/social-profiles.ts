export type SocialProfileLink = {
    href: string;
    target: "_self";
};

const SOCIAL_PROFILE_LINKS: Record<string, SocialProfileLink> = {
    LinkedIn: {
        href: "https://www.linkedin.com/company/prismconnex-global-solutions-private-limited/",
        target: "_self",
    },
    Instagram: {
        href: "https://www.instagram.com/prismconnex/?hl=en",
        target: "_self",
    },
    "X (Twitter)": {
        href: "https://x.com/prismconnex",
        target: "_self",
    },
};

export function getSocialProfileLink(provider: string): SocialProfileLink | null {
    return SOCIAL_PROFILE_LINKS[provider] ?? null;
}
