import {
    BookOpen,
    Brain,
    Building2,
    CheckCheck,
    CircleCheck,
    ClipboardCheck,
    Compass,
    Cpu,
    Database,
    FlaskConical,
    GraduationCap,
    HeartHandshake,
    Lightbulb,
    Link,
    type LucideIcon,
    MessageCircle,
    Network,
    ScanSearch,
    School,
    Server,
    Settings,
    ShieldCheck,
    ShieldHalf,
    Smartphone,
    Wifi,
    Workflow,
} from 'lucide-react';
import { SKILL_CONTENT } from '../../content/skills';
import { SKILL_BRANCH_CONTENT } from '../../content/skillTree';
import type { SkillIcon } from '../../game/contentTypes';
import { SKILLS } from '../../game/skills';
import type { Branch } from '../../game/types';

const icons = {
    BookOpen,
    Brain,
    Building2,
    CheckCheck,
    CircleCheck,
    ClipboardCheck,
    Compass,
    Cpu,
    Database,
    FlaskConical,
    GraduationCap,
    HeartHandshake,
    Lightbulb,
    Link,
    MessageCircle,
    Network,
    ScanSearch,
    School,
    Server,
    Settings,
    ShieldCheck,
    ShieldHalf,
    Smartphone,
    Wifi,
    Workflow,
} satisfies Record<SkillIcon, LucideIcon>;

export const SKILL_BRANCHES = Object.fromEntries(
    Object.entries(SKILL_BRANCH_CONTENT).map(([branch, content]) => [
        branch,
        { ...content, icon: icons[content.icon] },
    ]),
) as Record<Branch, { icon: LucideIcon; label: string; initialValue: number }>;

export const SKILL_PRESENTATION: Record<string, { icon: LucideIcon; referenceGain: number }> =
    Object.fromEntries(
        SKILL_CONTENT.map((skill) => [
            skill.id,
            { icon: icons[skill.icon], referenceGain: skill.referenceGain },
        ]),
    );

export function referenceAbility(branch: Branch, learnedIds: string[]) {
    return SKILLS.filter(
        (skill) => skill.branch === branch && learnedIds.includes(skill.id),
    ).reduce(
        (value, skill) => value + SKILL_PRESENTATION[skill.id].referenceGain,
        SKILL_BRANCHES[branch].initialValue,
    );
}
