/**
 * All copy and links for the site live in this one file.
 * Edit text here; components never contain wording.
 *
 * All copy is real and final; no placeholder text remains.
 */
import type { ImageMetadata } from 'astro';
import portrait from '../assets/lyle.jpg';

export type SocialId = 'x' | 'instagram' | 'youtube' | 'tiktok' | 'github';

export interface Social {
	id: SocialId;
	name: string;
	handle: string;
	href: string;
	/** Highlighted in the contact section: listed first, with a boxed `featuredLabel` tag. */
	featured?: boolean;
	featuredLabel?: string;
}

export interface AffiliateLink {
	title: string;
	description: string;
	href: string;
	/** Optional key into `landing.groups`. Consecutive links with the same key are bracketed together. */
	group?: string;
}

export interface Chapter {
	title: string;
	text: string;
}

export interface Goal {
	title: string;
	text: string;
}

export interface Project {
	name: string;
	description: string;
	/** Optional. `null` hides the link. */
	link: string | null;
}

export const site = {
	meta: {
		title: 'Lyle Cole',
		description: 'Personal site of Lyle Cole.',
	},

	/** Top bar. Name sits in the centre, one tab each side. */
	nav: {
		name: 'Lyle Cole',
		left: { label: 'Heroes', href: '/heroes/' },
		right: { label: 'Faleth', href: '/faleth/' },
	},

	person: {
		name: 'Lyle Cole',
		descriptor: 'High agency enabler and nitwit. Proverbs 29:18.',
		/**
		 * Set to an imported image to show a portrait, e.g.
		 *   import portrait from '../assets/lyle.jpg';
		 *   photo: portrait,
		 * Put the file in src/assets/. Leave `null` to show the placeholder frame.
		 */
		photo: portrait as ImageMetadata | null,
		photoAlt: 'Portrait of Lyle Cole',
		photoPlaceholderLabel: 'Photo',
	},

	landing: {
		useLabel: 'What I use',
		/** Append more objects here to add more links. */
		links: [
			{
				title: 'MyShop',
				description: 'Where I get my supplements and sports nutrition.',
				href: 'https://www.amway.com/en_US/myshop/ColeHolistics',
			},
			{
				title: 'Avellum Health',
				description: 'Where I get my bloodwork and peptides.',
				href: 'https://www.avellumhealth.com/',
				group: 'discounts',
			},
			{
				title: 'Valdura',
				description: 'How I monitor my health.',
				href: 'https://www.valdura.health/',
				group: 'discounts',
			},
		] as AffiliateLink[],
		/** Notes for bracketed groups of links (see `group` on a link). */
		groups: {
			discounts: { note: 'Ask me for discounts' },
		} as Record<string, { note: string }>,
		/** Set to '' to hide. */
		affiliateNote: 'I may earn from some of these links.',
		findLabel: 'Find me',
	},

	socials: [
		{ id: 'x', name: 'X', handle: '@LyleBCole', href: 'https://x.com/LyleBCole', featured: true, featuredLabel: 'MOST ACTIVE' },
		{
			id: 'instagram',
			name: 'Instagram',
			handle: '@lyle.cole.12',
			href: 'https://www.instagram.com/lyle.cole.12',
		},
		{
			id: 'youtube',
			name: 'YouTube',
			handle: '@ThatCakeIsAPie',
			href: 'https://www.youtube.com/@ThatCakeIsAPie',
		},
		{
			id: 'tiktok',
			name: 'TikTok',
			handle: '@lyle.cole95',
			href: 'https://www.tiktok.com/@lyle.cole95',
		},
		{
			id: 'github',
			name: 'GitHub',
			handle: 'ThatCakeIsAPie',
			href: 'https://github.com/ThatCakeIsAPie',
		},
	] as Social[],

	story: {
		id: 'story',
		label: 'My story',
		/** Optional display heading; '' hides it. */
		heading: 'I started off wanting to live a pretty normal life.',
		/** Optional; '' hides it. */
		intro: '',
		chapters: [
			{
				title: 'The call',
				text: 'One day, I saw what I believed to be a great and powerful evil in the world. I didn’t really know Christ at the time, but I knew He had given me gifts for a reason, and that I was going to use them to stand up against what I was witnessing. That was how I realized I needed to be an entrepreneur.',
			},
			{
				title: 'Texas',
				text: 'After having my heart broken early on by someone I thought I was going to be with, I moved to Texas for the business opportunities I knew I would find there.',
			},
			{
				title: 'The mentor',
				text: 'There I met the person who would influence my life more than anyone else, a man named Richard. He helped me get a business started and brought me into his mastermind group, where he had learned how to run a business properly and ethically.',
			},
			{
				title: 'Today',
				text: 'I still have that business, and I’m still growing it. I’m also a partner in a second business, in the defense industry, and it is doing very well.',
			},
		] as Chapter[],
	},

	goals: {
		id: 'goals',
		label: 'Goals',
		// Optional display heading; '' hides it.
		heading: '',
		items: [
			{
				title: 'Faith',
				text: 'I’m a follower of Christ. Growing the kingdom is my first and primary goal.',
			},
			{
				title: 'Family',
				text: 'My second goal is to create wealth for my family, so that I can be a present husband to my wife and father to my eventual kids.',
			},
			{
				title: 'Legacy',
				text: 'My third goal is to leave a legacy by helping others do the first two themselves.',
			},
		] as Goal[],
		workingLabel: 'What I am working on',
		working: [
			{
				name: 'Health',
				description: 'Helping people live healthy through the vendors I’m affiliated with, linked above.',
				link: null,
			},
			{
				name: 'People',
				description: 'Developing others to the point they no longer need me.',
				link: null,
			},
			{
				name: 'Ownership',
				description: 'Building businesses where people earn in proportion to the useful work they create, with ownership and equity for doing it. The goal is that they get wealthy and the business no longer needs me day to day.',
				link: null,
			},
		] as Project[],
		linkLabel: 'Visit',
	},

	contact: {
		id: 'contact',
		label: 'Get in touch',
		/** Optional display heading; '' hides it. */
		heading: '',
		text: 'If you like what you hear and want to get to know me more, follow me and my work on any of my platforms. I’m most active on X. Or reach out through the contact form, and I’ll get back to you personally.',
		form: {
			// Worker that validates, spam-checks and stores submissions (worker/). The env override is for local previews only.
			endpoint: import.meta.env.PUBLIC_CONTACT_ENDPOINT || 'https://coleholistics-contact.lylecole.workers.dev/contact',
			// Public Turnstile site key (not a secret). Widget: "coleholistics.us contact form".
			turnstileSiteKey: import.meta.env.PUBLIC_TURNSTILE_SITE_KEY || '0x4AAAAAAF9eeUGjN6A5WYDC',
			nameLabel: 'Name',
			phoneLabel: 'Phone',
			emailLabel: 'Email (optional)',
			messageLabel: 'What are you reaching out about?',
			honeypotLabel: 'Company',
			button: 'Send',
			sending: 'Sending…',
			note: 'I’ll only use this to get back to you.',
			success: 'Thanks. I’ll be in touch.',
			error: 'That didn’t go through. Try again, or reach me through any of the links below.',
			noscript: 'This form needs JavaScript. Reach me through any of the links below.',
			// Field-level messages; the client mirrors the server's rules (worker/src/validate.ts).
			errors: {
				name_required: 'Please enter your name.',
				name_too_long: 'That name is too long (100 characters at most).',
				phone_required: 'Please enter a phone number.',
				phone_invalid: 'Enter a valid phone number: 7 to 15 digits, with an optional + at the start.',
				email_invalid: 'That email address doesn’t look right.',
				email_too_long: 'That email address is too long.',
				message_required: 'Tell me what you’re reaching out about.',
				invalid_message: 'That’s too long: 300 characters at most.',
			},
		},
	},

	footer: {
		text: '© 2026 Lyle Cole',
	},

	/** /heroes/ : real copy, used as written. No figures, no pin levels, no testimonials. */
	heroes: {
		title: 'Heroes · Lyle Cole',
		description: 'Heroes is my network marketing team. It exists to build indestructible business leaders.',
		label: 'TEAM HEROES',
		heading: 'HEROES',
		intro: 'My network marketing team.',
		why: {
			label: 'WHY IT EXISTS',
			statement: 'To build indestructible business leaders.',
			text: 'We do it by helping you build a business of your own that you run, and by getting you plugged into rooms where you’re surrounded by like-minded people, growing through opt-in accountability and one-on-one mentorship.',
		},
		get: {
			label: 'WHAT YOU GET',
			items: [
				{ title: 'A BUSINESS OF YOUR OWN', text: 'One that you run.' },
				{ title: 'THE ROOM', text: 'Surrounded by like-minded people.' },
				{ title: 'ACCOUNTABILITY', text: 'Opt-in. You choose it.' },
				{ title: 'MENTORSHIP', text: 'One on one.' },
			],
		},
		framework: {
			label: 'THE FRAMEWORK',
			intro: 'Our framework is universal.',
			steps: ['Where you are.', 'Where you want to go.', 'What’s blocking the way.', 'Removing it.'],
		},
		journey: {
			label: 'THE JOURNEY',
			intro: 'The name comes from the hero’s journey: you are the hero of your own growth story, and the team is the dojo where you train.',
			stages: [
				{
					title: 'THE CALL',
					text: 'You feel the call to adventure. You probably refuse it at first, until you meet the mentor. With their help, you cross the threshold. That is getting started in business.',
				},
				{
					title: 'THE TESTS',
					text: 'Tests, allies and enemies. Early wins and losses. Some people support you, others don’t. You might lose your job or your car, but you push through anyway and start to win.',
				},
				{
					title: 'THE ROAD BACK',
					text: 'You now know ways to win reliably, and you have real momentum in your business.',
				},
				{
					title: 'THE RETURN',
					text: 'You return with wisdom, credibility and the conviction that it works. Now you are the mentor, and you find others who are just starting to feel the call, coming out of their ordinary world.',
				},
			],
		},
		rules: {
			label: 'GROUND RULES',
			items: [
				{
					title: 'THE DOOR STAYS OPEN',
					text: 'When people can leave anytime, they’re more likely to stay. One group has customers, the other has hostages, and only one sends referrals.',
				},
				{ title: 'RESULTS OVER INFORMATION', text: 'Information is a commodity. Results are the signal.' },
				{
					title: 'NO HYPE',
					text: 'No income claims, lifestyle hype, fake testimonials or invented results. Nobody is pushed to go all-in.',
				},
			],
		},
	},

	/** /faleth/ : real copy, used as written. */
	faleth: {
		/**
		 * false: /faleth/ shows only the teaser below, and the nine document pages are not built.
		 * true: the full page and the documents are published again. Everything under this block is kept for that.
		 */
		revealed: false,
		teaser: {
			description: 'Faleth Capital. To be revealed soon.',
			line: 'To be revealed soon.',
		},
		title: 'Faleth Capital · Lyle Cole',
		description: 'A family office. It buys and holds operating businesses and never flips them.',
		name: 'Faleth',
		sub: 'Capital',
		statement: 'Faleth Capital is what I’m building toward.',
		lede: 'A family office. It buys and holds operating businesses and never flips them.',
		note: 'The name comes from “Fah Leth”, meaning individual. The organization should strengthen a person’s agency, not swallow it.',
		mission: {
			label: 'Mission',
			text: 'Create and steward generational wealth. Make it reachable for people who never had a path to it, and prove that paying for value beats paying for time.',
		},
		doors: {
			label: 'Three doors',
			items: [
				{ title: 'Build', text: 'Work in a subsidiary and earn Class B. No capital needed.', tag: '' },
				{ title: 'Invest', text: 'Open a Managed Capital Account.', tag: 'Not offered yet' },
				{
					title: 'Refer',
					text: 'Earn referral credits: 20% of what a referred customer spends, for as long as they keep spending. Credits never expire, and it runs only one level deep. Refer five customers who spend what you spend and your own service is free.',
					tag: '',
				},
			],
		},
		office: {
			label: 'The office and subsidiaries',
			text: 'The office is a thin parent. Its own people run each subsidiary with full autonomy over hiring, pricing, strategy and culture.',
			mustLabel: 'Every subsidiary must',
			must: [
				'Pay people under the Contribution Framework, not wages.',
				'Pay the office fee.',
				'Report its financials quarterly.',
				'Make Class B available to everyone who participates.',
			],
			closing: 'Once a subsidiary outgrows one team, it splits into cells: small, self-governing teams that each run the same system. Businesses can be built from scratch or acquired.',
		},
		pay: {
			label: 'How people are paid',
			intro: 'No wages. People are owners, not employees.',
			layers: [
				{ title: 'Floor', text: 'A modest guaranteed weekly minimum that removes survival anxiety.' },
				{ title: 'Value share', text: 'Pay per job, based on the points each person put into it. This is most of their pay.' },
				{ title: 'Ownership stake', text: 'A share of the profit their work produces.' },
			],
			closing: 'No time clock. People set their own hours. The points system is checked for fairness every quarter.',
		},
		ownership: {
			label: 'Ownership',
			classes: [
				{ title: 'Class A', text: 'The vote. You can’t buy it. A founder earns it once their subsidiary is profitable for eight straight quarters.' },
				{ title: 'Class B', text: 'Earned dividends with no vote. It’s minted only from earned gain share, never bought. You can cash out at book value anytime, and it goes with you if you leave.' },
			],
			closing: 'Book value is assets minus liabilities minus unrealized gains.',
		},
		governance: {
			label: 'Governance and exit',
			items: [
				{ lead: 'Radical transparency.', text: 'Every participant sees the financials every quarter.' },
				{ lead: 'Peaceful fork:', text: 'anyone can leave and take what they built, valued at book value. There’s no trapping, and earned stakes travel with the person.' },
			],
		},
		buckets: {
			label: 'Two buckets',
			items: [
				{ title: 'Bucket One', text: 'The safety net: land, real estate and index funds.' },
				{ title: 'Bucket Two', text: 'Active income: pay, gain share and dividends.' },
			],
		},
		steps: {
			label: 'The five steps',
			items: [
				'Start in network marketing. It’s the leadership dojo.',
				'Maximize active income through current work or a Faleth subsidiary.',
				'Build the network to full-time, until it funds Bucket One on its own.',
				'Build your own subsidiary. The office funds it and a member mentors it.',
				'Grow both indefinitely. Earn Class A and mentor the next person.',
			],
			/** Attached under step I. `linkLabel` is the linked word; `rest` follows it. */
			firstNote: { linkLabel: 'Heroes', href: '/heroes/', rest: ', my optional network marketing team, is one example of what that can look like.' },
			closing: 'The five steps aren’t a requirement. Not everyone walks all five, and that’s fine. At every step the barrier is effort and time, not capital or connections.',
		},
		doing: {
			label: 'What I’m doing',
			text: 'I’m building the first version. Early on, I set the culture by example. Later, I remove restrictions so incentives keep the system healthy. People are the most important resource. The best people produce the best results, so I am strict about doing right by them.',
		},
		/** The nine documents (fetched at build time from GitHub, see README); this is only the list's chrome. */
		documents: {
			label: 'The documents',
			text: 'The nine documents this page is drawn from. Where they differ from this page, they win.',
			updated: 'Updated',
		},
		/** Chrome of the document pages at /faleth/<slug>/. */
		doc: {
			eyebrow: 'Faleth Capital · Document',
			titleSuffix: 'Faleth Capital · Lyle Cole',
			descriptionFallback: 'A Faleth Capital document.',
			updated: 'Updated',
			tocLabel: 'On this page',
			prev: 'Previous',
			next: 'Next',
			back: 'Back to Faleth',
			pagerLabel: 'Other Faleth Capital documents',
		},
	},
};

export type Site = typeof site;
