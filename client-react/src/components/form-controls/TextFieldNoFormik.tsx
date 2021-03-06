import React, { FC, useContext } from 'react';
import { TextField as OfficeTextField, ITextFieldProps } from 'office-ui-fabric-react/lib/TextField';
import ReactiveFormControl from './ReactiveFormControl';
import { useWindowSize } from 'react-use';
import { ThemeContext } from '../../ThemeContext';
import { textFieldStyleOverrides, copyButtonStyle } from './formControl.override.styles';
import { TooltipHost } from 'office-ui-fabric-react';
import IconButton from '../IconButton/IconButton';
import { useTranslation } from 'react-i18next';
import { TextUtilitiesService } from '../../utils/textUtilities';

interface CustomTextFieldProps {
  id: string;
  upsellMessage?: string;
  infoBubbleMessage?: string;
  label: string;
  learnMoreLink?: string;
  dirty?: boolean;
  widthOverride?: string;
  copyButton?: boolean;
}
const TextFieldNoFormik: FC<ITextFieldProps & CustomTextFieldProps> = props => {
  const { value, onChange, onBlur, errorMessage, label, dirty = false, widthOverride, styles, id, copyButton, ...rest } = props;
  const { width } = useWindowSize();
  const theme = useContext(ThemeContext);
  const { t } = useTranslation();
  const fullpage = width > 1000;

  const copyToClipboard = () => {
    TextUtilitiesService.copyContentToClipboard(value || '');
  };

  return (
    <ReactiveFormControl {...props}>
      <OfficeTextField
        id={id}
        aria-labelledby={`${id}-label`}
        value={value || ''}
        tabIndex={0}
        onChange={onChange}
        onBlur={onBlur}
        errorMessage={errorMessage}
        styles={textFieldStyleOverrides(dirty, theme, fullpage, widthOverride)}
        {...rest}
      />
      {copyButton && (
        <TooltipHost content={t('copypre_copyClipboard')} calloutProps={{ gapSpace: 0 }}>
          <IconButton
            className={copyButtonStyle(theme)}
            id={`${id}-copy-button`}
            iconProps={{ iconName: 'Copy' }}
            onClick={copyToClipboard}
          />
        </TooltipHost>
      )}
    </ReactiveFormControl>
  );
};
export default TextFieldNoFormik;
