import photos from '../../game/data/facility-photos.json';
import styles from './FacilityPhoto.module.css';

type Photo = {
    src: string;
    subject: string;
    relation: string;
    source: string;
    author: string;
    license: string;
    licenseUrl: string;
    changes: string;
};

const facilityPhotos: Partial<Record<string, Photo>> = photos;

export function FacilityPhoto({ id }: { id: string }) {
    const photo = facilityPhotos[id];
    if (!photo) return null;
    return (
        <figure className={styles.photo}>
            <img
                src={`${import.meta.env.BASE_URL}${photo.src.slice(1)}`}
                alt={photo.subject}
                width={960}
                height={540}
            />
            <figcaption>
                <span>{photo.subject}</span>
                <details>
                    <summary>写真の出典</summary>
                    <p>
                        <a href={photo.source} target="_blank" rel="noreferrer">
                            {photo.author}
                        </a>
                        {' / '}
                        <a href={photo.licenseUrl} target="_blank" rel="noreferrer">
                            {photo.license}
                        </a>
                        <br />
                        {photo.relation}
                        <br />
                        {photo.changes}
                    </p>
                </details>
            </figcaption>
        </figure>
    );
}
