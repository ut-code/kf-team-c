import type { Skill } from './types.ts';

export type SkillIcon =
    | 'BookOpen'
    | 'Brain'
    | 'Building2'
    | 'CheckCheck'
    | 'CircleCheck'
    | 'ClipboardCheck'
    | 'Compass'
    | 'Cpu'
    | 'Database'
    | 'FlaskConical'
    | 'GraduationCap'
    | 'HeartHandshake'
    | 'Lightbulb'
    | 'Link'
    | 'MessageCircle'
    | 'Network'
    | 'ScanSearch'
    | 'School'
    | 'Server'
    | 'Settings'
    | 'ShieldCheck'
    | 'ShieldHalf'
    | 'Smartphone'
    | 'Wifi'
    | 'Workflow';

export interface SkillContent extends Skill {
    icon: SkillIcon;
    referenceGain: number;
}

export interface SkillBranchContent {
    icon: SkillIcon;
    label: string;
    initialValue: number;
}
