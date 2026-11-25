export interface ProviderRequirement {
  label: string;
  type: string;
  placeholder: string;
  required: boolean;
  minLength?: number;
  value: string;
}

export interface ProviderDefinition {
  label: string;
  logo?: string;
  key: string;
  isEnabled: boolean;
  activeInSite: boolean;
  requirements: ProviderRequirement[];
}
