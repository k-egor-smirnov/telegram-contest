import React from '../../../lib/teact/teactn';

import buildClassName from '../../../util/buildClassName';

import styles from './MaskIcon.module.scss';

type OwnProps = {
  src?: string;
  className?: string;
};

export default function MaskIcon({ src, className }: OwnProps) {
  return (
    <div
      className={buildClassName(styles.img, className)}
      style={`--mask-icon-src: url('${src}')`}
    />
  );
}
