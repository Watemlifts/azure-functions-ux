import React, { useContext, useState, useEffect, useRef } from 'react';
import FeatureDescriptionCard from '../../../components/feature-description-card/FeatureDescriptionCard';
import { PrimaryButton, IDropdownOption, Stack, Link, ILink, MessageBar, MessageBarType } from 'office-ui-fabric-react';
import { Formik, FormikProps } from 'formik';
import { ResourceGroup } from '../../../models/resource-group';
import { style } from 'typestyle';
import { ArmSiteDescriptor, ArmPlanDescriptor } from '../../../utils/resourceDescriptors';
import { CreateOrSelectPlan, CreateOrSelectPlanFormValues, NEW_PLAN, addNewPlanToOptions } from './CreateOrSelectPlan';
import SiteService from '../../../ApiHelpers/SiteService';
import ResourceGroupService from '../../../ApiHelpers/ResourceGroupService';
import ServerFarmService from '../../../ApiHelpers/ServerFarmService';
import { PortalContext } from '../../../PortalContext';
import PortalCommunicator from '../../../portal-communicator';
import { getDefaultServerFarmName } from '../../../utils/formValidation/serverFarmValidator';
import { addNewRgOption } from './CreateOrSelectResourceGroup';
import LogService from '../../../utils/LogService';
import { ReactComponent as AppServicePlanSvg } from '../../../images/AppService/app-service-plan.svg';
import { useTranslation } from 'react-i18next';
import i18next from 'i18next';
import { SpecPickerOutput } from '../spec-picker/specs/PriceSpec';
import { useWindowSize } from 'react-use';
import { BroadcastMessageId } from '../../../models/portal-models';
import { FormControlWrapper } from '../../../components/FormControlWrapper/FormControlWrapper';
import { LogCategories } from '../../../utils/LogCategories';
import { ArmObj, ArmSku } from '../../../models/arm-obj';
import { Site } from '../../../models/site/site';
import { ServerFarm } from '../../../models/serverFarm/serverfarm';
import { HostingEnvironment } from '../../../models/hostingEnvironment/hosting-environment';
import { ScenarioService } from '../../../utils/scenario-checker/scenario.service';
import { ScenarioIds } from '../../../utils/scenario-checker/scenario-ids';
import { CommonConstants } from '../../../utils/CommonConstants';

export const leftCol = style({
  marginRight: '20px',
});

const wrapperStyle = {
  padding: '30px',
};

const formStyle = {
  marginTop: '30px',
};

const fieldStyle = {
  marginTop: '20px',
};

const sectionStyle = {
  marginTop: '10px',
};

const labelSectionStyle = style({
  textTransform: 'uppercase',
  fontSize: '11px',
  fontWeight: '600',
} as any); // Casting to any because style definition doesn't support 600 even though it's valid CSS

const labelStyle = style({
  width: '250px',
});

const footerStyle = style({
  marginTop: '50px',
});

const MaxHorizontalWidthPx = 750;

interface CompletionTelemetry {
  success: boolean;
  newResourceGroup: boolean;
  newPlan: boolean;
  resourceId?: string;
  message?: string;
}

export interface ChangeAppPlanProps {
  site: ArmObj<Site>;
  currentServerFarm: ArmObj<ServerFarm>;
  hostingEnvironment?: ArmObj<HostingEnvironment>;
  resourceGroups: ArmObj<ResourceGroup>[];
  serverFarms: ArmObj<ServerFarm>[];
  onChangeComplete: () => void;
}

export interface ChangeAppPlanFormValues {
  site: ArmObj<Site>;
  currentServerFarm: ArmObj<ServerFarm>;
  serverFarmInfo: CreateOrSelectPlanFormValues;
}

export const ChangeAppPlan: React.SFC<ChangeAppPlanProps> = props => {
  const { resourceGroups, serverFarms, site, currentServerFarm, hostingEnvironment, onChangeComplete: onChangeComplete } = props;

  const [isUpdating, setIsUpdating] = useState(false);
  const [siteIsReadOnlyLocked, setSiteIsReadOnlyLocked] = useState(false);
  const [showAppDensityWarning, setShowAppDensityWarning] = useState(false);
  const portalCommunicator = useContext(PortalContext);
  const { width } = useWindowSize();
  const changeSkuLinkElement = useRef<ILink | null>(null);
  const { t } = useTranslation();

  const [formValues, setFormValues] = useState<ChangeAppPlanFormValues>(
    getInitialFormValues(site, currentServerFarm, serverFarms, resourceGroups)
  );

  // Initialization
  useEffect(() => {
    checkIfSiteIsLocked(portalCommunicator, site.id, setSiteIsReadOnlyLocked);
  }, []);

  useEffect(() => {
    if (isUpdating) {
      portalCommunicator.updateDirtyState(true, t('cancelUpdateConfirmation'));
    } else {
      portalCommunicator.updateDirtyState(false);
    }
  }, [isUpdating]);

  useEffect(() => {
    updateAppDensityWarning(setShowAppDensityWarning, formValues.serverFarmInfo, t);
  }, [formValues]);

  const rgOptions = getDropdownOptions(resourceGroups);
  addNewRgOption(formValues.serverFarmInfo.newPlanInfo.newResourceGroupName, rgOptions, t);

  const serverFarmOptions = getDropdownOptions(serverFarms);
  addNewPlanToOptions(formValues.serverFarmInfo.newPlanInfo.name, serverFarmOptions, t);

  const onPlanChange = (form: FormikProps<ChangeAppPlanFormValues>, planInfo: CreateOrSelectPlanFormValues) => {
    form.setFieldValue('serverFarmInfo', planInfo);
    updateAppDensityWarning(setShowAppDensityWarning, planInfo, t);
  };

  if (rgOptions.length === 0) {
    const newResourceGroupName = formValues.serverFarmInfo.newPlanInfo.newResourceGroupName;
    rgOptions.unshift({
      key: newResourceGroupName,
      text: newResourceGroupName,
      data: newResourceGroupName,
      selected: true,
    });
  }

  if (serverFarmOptions.length === 0) {
    serverFarmOptions.unshift({
      key: formValues.serverFarmInfo.newPlanInfo.name,
      text: t('newFormat').format(formValues.serverFarmInfo.newPlanInfo.name),
      data: NEW_PLAN,
      selected: true,
    });
  }

  const subscriptionId = new ArmPlanDescriptor(currentServerFarm.id).subscription;

  return (
    <>
      {getWarningBar(siteIsReadOnlyLocked, t, showAppDensityWarning, formValues)}
      <div style={wrapperStyle}>
        <Formik
          initialValues={formValues}
          onSubmit={values => onSubmit(values, setIsUpdating, setFormValues, portalCommunicator, t, onChangeComplete)}>
          {(formProps: FormikProps<ChangeAppPlanFormValues>) => {
            return (
              <form>
                <header>
                  <FeatureDescriptionCard name={t('changePlanName')} description={t('changePlanDescription')} Svg={AppServicePlanSvg} />
                </header>

                <section>
                  <Stack style={formStyle}>
                    <Stack style={sectionStyle}>
                      <h4 className={labelSectionStyle}>{t('changePlanCurrentPlanDetails')}</h4>
                    </Stack>

                    <FormControlWrapper label={t('appServicePlan')}>
                      <div tabIndex={0} aria-label={t('appServicePlan') + getPlanName(currentServerFarm)}>
                        {getPlanName(currentServerFarm)}
                      </div>
                    </FormControlWrapper>

                    <Stack style={{ marginTop: '50px' }}>
                      <h4 className={labelSectionStyle}>{t('changePlanDestPlanDetails')}</h4>
                    </Stack>

                    <FormControlWrapper label={t('appServicePlan')} required={true}>
                      <CreateOrSelectPlan
                        subscriptionId={subscriptionId}
                        isNewPlan={formProps.values.serverFarmInfo.isNewPlan}
                        newPlanInfo={formProps.values.serverFarmInfo.newPlanInfo}
                        existingPlan={formProps.values.serverFarmInfo.existingPlan}
                        options={serverFarmOptions}
                        resourceGroupOptions={rgOptions}
                        onPlanChange={info => {
                          onPlanChange(formProps, info);
                        }}
                        serverFarmsInWebspace={serverFarms}
                        hostingEnvironment={hostingEnvironment}
                      />
                    </FormControlWrapper>

                    <FormControlWrapper label={t('resourceGroup')} style={{ marginTop: '25px' }}>
                      <div
                        tabIndex={0}
                        aria-label={t('resourceGroup') + getSelectedResourceGroupString(formProps.values.serverFarmInfo, t)}>
                        {getSelectedResourceGroupString(formProps.values.serverFarmInfo, t)}
                      </div>
                    </FormControlWrapper>

                    <FormControlWrapper label={t('region')} style={fieldStyle} tooltip={t('changePlanLocationTooltip')}>
                      <span tabIndex={0} aria-label={t('region') + site.location}>
                        {site.location}
                      </span>
                    </FormControlWrapper>

                    <Stack horizontal={width > MaxHorizontalWidthPx} disableShrink style={fieldStyle}>
                      <label className={labelStyle}>{t('pricingTier')}</label>
                      {getPricingTierValue(currentServerFarm.id, formProps, changeSkuLinkElement, portalCommunicator, t)}
                    </Stack>
                  </Stack>
                </section>

                <footer className={footerStyle}>
                  <PrimaryButton
                    data-automation-id="test"
                    text={t('ok')}
                    allowDisabledFocus={true}
                    onClick={formProps.submitForm}
                    disabled={isUpdating || siteIsReadOnlyLocked}
                  />
                </footer>
              </form>
            );
          }}
        </Formik>
      </div>
    </>
  );
};

const checkIfSiteIsLocked = async (
  portalCommunicator: PortalCommunicator,
  resourceId: string,
  setSiteIsReadOnlyLocked: React.Dispatch<React.SetStateAction<boolean>>
) => {
  const readOnly = await portalCommunicator.hasLock(resourceId, 'ReadOnly');
  setSiteIsReadOnlyLocked(readOnly);
};

const updateAppDensityWarning = async (
  setShowAppDensityWarning: React.Dispatch<React.SetStateAction<boolean>>,
  planInfo: CreateOrSelectPlanFormValues,
  t: any
) => {
  const scenarioChecker = new ScenarioService(t);
  if (!planInfo.isNewPlan && planInfo.existingPlan && planInfo.existingPlan.id && planInfo.existingPlan.sku) {
    scenarioChecker.checkScenarioAsync(ScenarioIds.isAppDensityEnabled, { serverFarm: planInfo.existingPlan }).then(result => {
      setShowAppDensityWarning(result.status !== 'disabled');
    });
  } else {
    setShowAppDensityWarning(false);
  }
};

const getWarningBar = (
  siteIsReadOnlyLocked: boolean,
  t: i18next.TFunction,
  showAppDensityWarning: boolean,
  formValues: ChangeAppPlanFormValues
) => {
  if (siteIsReadOnlyLocked) {
    return <MessageBar messageBarType={MessageBarType.warning}>{t('changePlanSiteLockedError')}</MessageBar>;
  } else if (showAppDensityWarning) {
    const planName = !!formValues.serverFarmInfo.existingPlan && formValues.serverFarmInfo.existingPlan.name;
    return (
      <MessageBar messageBarType={MessageBarType.warning}>
        {t('pricing_appDensityWarningMessage').format(planName)}
        <Link href={CommonConstants.Links.appDensityWarningLink} target="_blank">
          {t('learnMore')}
        </Link>
      </MessageBar>
    );
  }
};

const getPricingTierValue = (
  currentServerFarmId: string,
  form: FormikProps<ChangeAppPlanFormValues>,
  linkElement: React.MutableRefObject<ILink | null>,
  portalCommunicator: PortalCommunicator,
  t: i18next.TFunction
) => {
  const skuString = getSelectedSkuString(form.values);

  if (form.values.serverFarmInfo.isNewPlan) {
    return (
      <Link
        aria-label={t('pricingTier') + skuString}
        onClick={() => openSpecPicker(currentServerFarmId, form, linkElement, portalCommunicator)}
        componentRef={ref => (linkElement.current = ref)}>
        {skuString}
      </Link>
    );
  }

  return (
    <span tabIndex={0} aria-label={t('pricingTier') + skuString}>
      {getSelectedSkuString(form.values)}
    </span>
  );
};

const openSpecPicker = async (
  currentServerFarmId: string,
  form: FormikProps<ChangeAppPlanFormValues>,
  linkElement: React.MutableRefObject<ILink | null>,
  portalCommunicator: PortalCommunicator
) => {
  const result = await portalCommunicator.openBlade<SpecPickerOutput>(
    {
      detailBlade: 'SpecPickerFrameBlade',
      detailBladeInputs: {
        id: currentServerFarmId,
        data: {
          selectedSkuCode: 'F1',
          returnObjectResult: true,
        },
      },
      openAsContextBlade: true,
    },
    'changeAppPlan'
  );

  (linkElement.current as ILink).focus();

  if (result.reason === 'childClosedSelf') {
    const newServerFarmInfo = {
      ...form.values.serverFarmInfo,
      newPlanInfo: {
        ...form.values.serverFarmInfo.newPlanInfo,
        skuCode: result.data.value.skuCode,
        tier: result.data.value.tier,
      },
    };

    form.setFieldValue('serverFarmInfo', newServerFarmInfo);
  }
};

const getCompletionTelemtry = (
  success: boolean,
  newResourceGroup: boolean,
  newPlan: boolean,
  resourceId?: string,
  message?: string
): CompletionTelemetry => {
  return {
    success,
    newResourceGroup,
    newPlan,
    resourceId,
    message,
  };
};

const onSubmit = async (
  values: ChangeAppPlanFormValues,
  setIsUpdating: React.Dispatch<React.SetStateAction<boolean>>,
  setFormValues: React.Dispatch<React.SetStateAction<ChangeAppPlanFormValues>>,
  portalCommunicator: PortalCommunicator,
  t: i18next.TFunction,
  changeComplete: () => void
) => {
  const { serverFarmInfo } = values;
  const notificationId = portalCommunicator.startNotification(t('changePlanNotification'), t('changePlanNotification'));

  setFormValues(values);
  setIsUpdating(true);

  let success = false;
  if (!serverFarmInfo.isNewPlan) {
    success = await changeSiteToExistingPlan(notificationId, values, portalCommunicator, t);
  } else {
    success = await changeSiteToNewPlan(notificationId, values, portalCommunicator, t);
  }

  if (success) {
    changeComplete();
    portalCommunicator.broadcastMessage(BroadcastMessageId.siteUpdated, values.site.id);
  }

  setIsUpdating(false);
};

const changeSiteToExistingPlan = async (
  notificationId: string,
  formValues: ChangeAppPlanFormValues,
  portalCommunicator: PortalCommunicator,
  t: i18next.TFunction
) => {
  const { site, serverFarmInfo } = formValues;
  let success = false;

  if (!serverFarmInfo.existingPlan) {
    LogService.trackEvent(LogCategories.changeAppPlan, 'onSubmit', getCompletionTelemtry(false, false, false, '', 'existingPlan not set'));

    return success;
  }

  site.properties.serverFarmId = serverFarmInfo.existingPlan.id;

  const planDescriptor = new ArmPlanDescriptor(site.properties.serverFarmId);

  const siteResponse = await SiteService.updateSite(site.id, site);
  if (siteResponse.metadata.success) {
    portalCommunicator.stopNotification(notificationId, true, t('changePlanNotification'));
    LogService.trackEvent(LogCategories.changeAppPlan, 'onSubmit', getCompletionTelemtry(true, false, false, site.id));

    success = true;
  } else {
    const updateSiteError =
      siteResponse.metadata.error && siteResponse.metadata.error.Message ? siteResponse.metadata.error.Message : planDescriptor.name;
    portalCommunicator.stopNotification(notificationId, false, t('changePlanFailureNotificationFormat').format(updateSiteError));
    LogService.trackEvent(
      LogCategories.changeAppPlan,
      'onSubmit',
      getCompletionTelemtry(false, false, false, site.id, `Failed to update site: '${updateSiteError}'`)
    );
  }

  return success;
};

const changeSiteToNewPlan = async (
  notificationId: string,
  formValues: ChangeAppPlanFormValues,
  portalCommunicator: PortalCommunicator,
  t: i18next.TFunction
) => {
  const { site, serverFarmInfo, currentServerFarm } = formValues;
  const siteDescriptor = new ArmSiteDescriptor(site.id);
  let rgName = siteDescriptor.resourceGroup;

  if (serverFarmInfo.newPlanInfo.isNewResourceGroup) {
    const rgResponse = await ResourceGroupService.updateResourceGroup(
      siteDescriptor.subscription,
      serverFarmInfo.newPlanInfo.newResourceGroupName,
      site.location
    );

    if (!rgResponse.metadata.success) {
      const createRgError = rgResponse.metadata.error && rgResponse.metadata.error.Message ? rgResponse.metadata.error.Message : rgName;
      portalCommunicator.stopNotification(notificationId, false, t('changePlanRgCreateFailureNotificationFormat').format(createRgError));
      LogService.trackEvent(
        LogCategories.changeAppPlan,
        'onSubmit',
        getCompletionTelemtry(
          false,
          true,
          true,
          `/subscriptions/${siteDescriptor.subscription}/resourceGroups/${serverFarmInfo.newPlanInfo.newResourceGroupName}`,
          `Failed to update resource group: ${createRgError}`
        )
      );

      return false;
    }

    rgName = serverFarmInfo.newPlanInfo.newResourceGroupName;
  }

  const newServerFarmId = `/subscriptions/${siteDescriptor.subscription}/resourceGroups/${rgName}/providers/Microsoft.Web/serverFarms/${
    serverFarmInfo.newPlanInfo.name
  }`;

  // Purposely ignoring slots to avoid a back-end bug where if webSiteId is a slot resourceId, then you'll get a 404 on create.
  // This works because slots always have the same webspace as prod sites.
  const webSiteId = `/subscriptions/${siteDescriptor.subscription}/resourceGroups/${
    siteDescriptor.resourceGroup
  }/providers/Microsoft.Web/sites/${siteDescriptor.site}`;

  const newServerFarm = {
    id: newServerFarmId,
    name: serverFarmInfo.newPlanInfo.name,
    location: site.location,
    kind: currentServerFarm.kind,
    properties: {
      webSiteId,
      reserved: currentServerFarm.properties.reserved,
      isXenon: currentServerFarm.properties.isXenon,
      hostingEnvironmentId: currentServerFarm.properties.hostingEnvironmentId,
      hostingEnvironmentProfile: currentServerFarm.properties.hostingEnvironmentProfile,
    },
    sku: {
      name: getSelectedSkuCode(formValues),
    },
  };

  const planDescriptor = new ArmPlanDescriptor(newServerFarmId);
  const serverFarmResponse = await ServerFarmService.updateServerFarm(newServerFarmId, newServerFarm as ArmObj<ServerFarm>);

  if (!serverFarmResponse.metadata.success) {
    const createPlanError =
      serverFarmResponse.metadata.error && serverFarmResponse.metadata.error.Message
        ? serverFarmResponse.metadata.error.Message
        : planDescriptor.name;
    portalCommunicator.stopNotification(notificationId, false, t('changePlanPlanCreateFailureNotificationFormat').format(createPlanError));

    LogService.trackEvent(
      'ChangeAppPlan',
      'onSubmit',
      getCompletionTelemtry(
        false,
        serverFarmInfo.newPlanInfo.isNewResourceGroup,
        true,
        newServerFarmId,
        `Failed to create new serverfarm: '${createPlanError}'`
      )
    );

    return false;
  }

  site.properties.serverFarmId = newServerFarmId;

  const siteResponse = await SiteService.updateSite(site.id, site);
  if (!siteResponse.metadata.success) {
    const updateSiteError =
      siteResponse.metadata.error && siteResponse.metadata.error.Message ? siteResponse.metadata.error.Message : planDescriptor.name;
    portalCommunicator.stopNotification(notificationId, false, t('changePlanFailureNotificationFormat').format(updateSiteError));

    LogService.trackEvent(
      'ChangeAppPlan',
      'onSubmit',
      getCompletionTelemtry(
        false,
        serverFarmInfo.newPlanInfo.isNewResourceGroup,
        serverFarmInfo.isNewPlan,
        site.id,
        `Failed to update site: '${updateSiteError}'`
      )
    );

    return false;
  }

  portalCommunicator.stopNotification(notificationId, true, t('changePlanNotification'));

  LogService.trackEvent(
    'ChangeAppPlan',
    'onSubmit',
    getCompletionTelemtry(true, serverFarmInfo.newPlanInfo.isNewResourceGroup, serverFarmInfo.isNewPlan, site.id)
  );

  return true;
};

const getSelectedSkuString = (values: ChangeAppPlanFormValues) => {
  let tier: string;
  let skuCode: string;
  if (values.serverFarmInfo.isNewPlan) {
    skuCode = values.serverFarmInfo.newPlanInfo.skuCode;
    tier = values.serverFarmInfo.newPlanInfo.tier;
  } else {
    const sku: ArmSku = (values.serverFarmInfo.existingPlan as ArmObj<ServerFarm>).sku as ArmSku;
    skuCode = sku.name;
    tier = sku.tier;
  }

  return `${tier} (${skuCode}) `;
};

const getSelectedSkuCode = (values: ChangeAppPlanFormValues) => {
  if (values.serverFarmInfo.isNewPlan) {
    return values.serverFarmInfo.newPlanInfo.skuCode;
  }

  return ((values.serverFarmInfo.existingPlan as ArmObj<ServerFarm>).sku as ArmSku).name;
};

const getSelectedResourceGroupString = (values: CreateOrSelectPlanFormValues, t: i18next.TFunction) => {
  if (values.isNewPlan) {
    if (values.newPlanInfo.isNewResourceGroup) {
      return t('newFormat').format(values.newPlanInfo.newResourceGroupName);
    }

    return `${(values.newPlanInfo.existingResourceGroup as ArmObj<ResourceGroup>).name}`;
  }

  const planDescriptor = new ArmPlanDescriptor((values.existingPlan as ArmObj<ServerFarm>).id);
  return `${planDescriptor.resourceGroup}`;
};

const getPlanName = (serverFarm: ArmObj<ServerFarm>) => {
  const descriptor = new ArmPlanDescriptor(serverFarm.id);
  return descriptor.name;
};

const getDropdownOptions = (objs: ArmObj<any>[]) => {
  let options: IDropdownOption[] = [];
  if (objs) {
    for (let i = 0; i < objs.length; i = i + 1) {
      options = [
        ...options,
        {
          key: objs[i].id.toLowerCase(),
          text: objs[i].name,
          data: objs[i],
          selected: i === 0,
        },
      ];
    }
  }

  return options;
};

const getInitialFormValues = (
  site: ArmObj<Site>,
  currentServerFarm: ArmObj<ServerFarm>,
  serverFarms: ArmObj<ServerFarm>[],
  resourceGroups: ArmObj<ResourceGroup>[]
): ChangeAppPlanFormValues => {
  const existingPlan = serverFarms.length > 0 ? serverFarms[0] : null;
  const planDescriptor = new ArmPlanDescriptor(currentServerFarm.id);

  const existingResourceGroup: ArmObj<ResourceGroup> = {
    id: `/subscriptions/${planDescriptor.subscription}/resourceGroups/${planDescriptor.resourceGroup}`,
    properties: {},
    location: '',
    name: planDescriptor.resourceGroup,
  };

  const siteDescriptor = new ArmSiteDescriptor(site.id);
  const skuCode = currentServerFarm.sku ? currentServerFarm.sku.name : '';
  const tier = currentServerFarm.sku ? currentServerFarm.sku.tier : '';

  return {
    site,
    currentServerFarm,
    serverFarmInfo: {
      existingPlan,
      isNewPlan: !existingPlan,
      newPlanInfo: {
        existingResourceGroup,
        skuCode,
        tier,
        hasSubscriptionWritePermission: true,
        isNewResourceGroup: false,
        newResourceGroupName: '',
        name: getDefaultServerFarmName(siteDescriptor.resourceName),
      },
    },
  };
};
