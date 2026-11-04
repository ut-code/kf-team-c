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
import { SKILLS } from '../../game/skills';
import type { Branch } from '../../game/types';

// 表示専用の設定。ゲームの効果・習得条件には使用しない。
export const SKILL_BRANCHES = {
    IQ: {
        icon: Brain,
        label: '知性・推論',
        initialValue: 70,
    },
    EQ: {
        icon: HeartHandshake,
        label: '対話・共感',
        initialValue: 40,
    },
    SYSTEM: {
        icon: Network,
        label: '実行・社会接続',
        initialValue: 20,
    },
} satisfies Record<Branch, { icon: LucideIcon; label: string; initialValue: number }>;

// referenceGainは習得時に表示上の能力値へ加える量。上限や百分率は設けない。
export const SKILL_PRESENTATION: Record<string, { icon: LucideIcon; referenceGain: number }> = {
    reason: { icon: Brain, referenceGain: 8 },
    knowledge: { icon: BookOpen, referenceGain: 12 },
    verification: { icon: ScanSearch, referenceGain: 10 },
    tutor: { icon: GraduationCap, referenceGain: 14 },
    science: { icon: FlaskConical, referenceGain: 18 },
    audit: { icon: ClipboardCheck, referenceGain: 10 },
    privacy: { icon: ShieldHalf, referenceGain: 8 },
    curriculum: { icon: School, referenceGain: 16 },
    discovery: { icon: Lightbulb, referenceGain: 26 },
    certified: { icon: ShieldCheck, referenceGain: 12 },
    conversation: { icon: MessageCircle, referenceGain: 12 },
    personalize: { icon: Compass, referenceGain: 18 },
    memory: { icon: Database, referenceGain: 22 },
    companion: { icon: HeartHandshake, referenceGain: 30 },
    lightweight: { icon: Cpu, referenceGain: 8 },
    offline: { icon: Wifi, referenceGain: 10 },
    automation: { icon: Settings, referenceGain: 12 },
    mobile: { icon: Smartphone, referenceGain: 14 },
    distributed: { icon: Server, referenceGain: 18 },
    integration: { icon: Workflow, referenceGain: 16 },
    platform: { icon: Link, referenceGain: 18 },
    decision: { icon: CircleCheck, referenceGain: 22 },
    public: { icon: Building2, referenceGain: 24 },
    autonomous: { icon: CheckCheck, referenceGain: 28 },
    backbone: { icon: Network, referenceGain: 32 },
};

export function referenceAbility(branch: Branch, learnedIds: string[]) {
    return SKILLS.filter(
        (skill) => skill.branch === branch && learnedIds.includes(skill.id),
    ).reduce(
        (value, skill) => value + SKILL_PRESENTATION[skill.id].referenceGain,
        SKILL_BRANCHES[branch].initialValue,
    );
}
