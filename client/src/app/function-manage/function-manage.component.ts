import { FunctionAppContext } from './../shared/function-app-context';
import { BroadcastEvent } from 'app/shared/models/broadcast-event';
import { TreeUpdateEvent } from './../shared/models/broadcast-event';
import { ConfigService } from './../shared/services/config.service';
import { Component, Injector } from '@angular/core';
import { Subject } from 'rxjs/Subject';
import { TranslateService } from '@ngx-translate/core';
import { FunctionInfo } from '../shared/models/function-info';
import { SelectOption } from '../shared/models/select-option';
import { PortalService } from '../shared/services/portal.service';
import { PortalResources } from '../shared/models/portal-resources';
import { BindingManager } from '../shared/models/binding-manager';
import { errorIds } from './../shared/models/error-ids';
import { Observable } from 'rxjs/Observable';
import { FunctionAppService } from 'app/shared/services/function-app.service';
import { NavigableComponent, ExtendedTreeViewInfo } from '../shared/components/navigable-component';
import { DashboardType } from '../tree-view/models/dashboard-type';
import { FunctionService } from 'app/shared/services/function.service';
import { FunctionAppVersion } from 'app/shared/models/constants';
import { SiteService } from 'app/shared/services/site.service';
import { HttpResult } from 'app/shared/models/http-result';
import { ArmObj } from 'app/shared/models/arm/arm-obj';
import { ApplicationSettings } from 'app/shared/models/arm/application-settings';

@Component({
  selector: 'function-manage',
  templateUrl: './function-manage.component.html',
  styleUrls: ['./function-manage.component.css'],
})
export class FunctionManageComponent extends NavigableComponent {
  public functionStatusOptions: SelectOption<boolean>[];
  public functionInfo: FunctionInfo;
  public isStandalone: boolean;
  public isHttpFunction = false;
  public runtimeVersion: string;
  public functionStateValueChange: Subject<boolean>;
  public context: FunctionAppContext;

  constructor(
    private _portalService: PortalService,
    private _functionAppService: FunctionAppService,
    private _translateService: TranslateService,
    private _functionService: FunctionService,
    private _siteService: SiteService,
    injector: Injector,
    configService: ConfigService
  ) {
    super('function-manage', injector, DashboardType.FunctionManageDashboard);

    this.isStandalone = configService.isStandalone();

    this.functionStatusOptions = [
      {
        displayLabel: this._translateService.instant(PortalResources.enabled),
        value: false,
      },
      {
        displayLabel: this._translateService.instant(PortalResources.disabled),
        value: true,
      },
    ];

    this.functionStateValueChange = new Subject<boolean>();
    this.functionStateValueChange
      .switchMap(state => {
        this.setBusy();
        this.functionInfo.config.disabled = state;
        this.functionInfo.config.disabled
          ? this._portalService.logAction('function-manage', 'disable')
          : this._portalService.logAction('function-manage', 'enable');
        return this.runtimeVersion === 'V2'
          ? this._functionAppService.updateDisabledAppSettings(this.context, [this.functionInfo])
          : this._functionService.updateFunction(this.context.site.id, this.functionInfo);
      })
      .do(null, e => {
        this.functionInfo.config.disabled = !this.functionInfo.config.disabled;
        this.clearBusy();
        this.showComponentError({
          message: this._translateService.instant(PortalResources.failedToSwitchFunctionState, {
            state: !this.functionInfo.config.disabled,
            functionName: this.functionInfo.name,
          }),
          errorId: errorIds.failedToSwitchEnabledFunction,
          resourceId: this.context.site.id,
        });
        console.error(e);
      })
      .retry()
      .takeUntil(this.ngUnsubscribe)
      .subscribe(
        () => {
          this.clearBusy();
          this._broadcastService.broadcastEvent<TreeUpdateEvent>(BroadcastEvent.TreeUpdate, {
            resourceId: `${this.context.site.id}/functions/${this.functionInfo.name}`,
            operation: 'update',
            data: this.functionInfo.config.disabled,
          });
        },
        null,
        () => this.clearBusy()
      );
  }

  setup(navigationEvents: Observable<ExtendedTreeViewInfo>): Observable<any> {
    return super
      .setup(navigationEvents)
      .switchMap(view =>
        Observable.zip(this._functionAppService.getAppContext(view.siteDescriptor.getTrimmedResourceId()), Observable.of(view))
      )
      .switchMap(tuple =>
        Observable.zip(
          Observable.of(tuple[0]),
          this._functionService.getFunction(tuple[0].site.id, tuple[1].functionDescriptor.name),
          tuple[0].urlTemplates.runtimeVersion === FunctionAppVersion.v1
            ? Observable.of(null)
            : this._siteService.getAppSettings(tuple[0].site.id)
        )
      )
      .do(tuple => {
        this.runtimeVersion = tuple[0].urlTemplates.runtimeVersion;
        if (tuple[1].isSuccessful) {
          this._setFunctionInfo(tuple[1].result.properties, tuple[2]);
        }
        this.context = tuple[0];
        this.isHttpFunction = BindingManager.isHttpFunction(this.functionInfo);
      });
  }

  deleteFunction() {
    const result = confirm(this._translateService.instant(PortalResources.functionManage_areYouSure, { name: this.functionInfo.name }));
    if (result) {
      this.setBusy();
      this._portalService.logAction('function-manage', 'delete');
      // Clone node for removing as it can be change during http call
      this._functionService.deleteFunction(this.context.site.id, this.functionInfo.name).subscribe(() => {
        this._broadcastService.broadcastEvent<TreeUpdateEvent>(BroadcastEvent.TreeUpdate, {
          resourceId: `${this.context.site.id}/functions/${this.functionInfo.name}`,
          operation: 'remove',
        });
        this.clearBusy();
      });
    }
  }

  private _setFunctionInfo(functionInfo: FunctionInfo, appSettings: HttpResult<ArmObj<ApplicationSettings>> | null) {
    if (this.runtimeVersion !== FunctionAppVersion.v1) {
      let settingName: string;
      if (typeof functionInfo.config.disabled === 'string') {
        settingName = functionInfo.config.disabled;
      } else {
        settingName = `AzureWebJobs.${functionInfo.name}.Disabled`;
      }
      const result = appSettings && appSettings.isSuccessful && appSettings.result.properties[settingName];
      functionInfo.config.disabled = result === '1' || result === 'true';
    }
    this.functionInfo = functionInfo;
  }
}
