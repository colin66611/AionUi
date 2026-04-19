/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { IMessageAcpElicitation } from '@/common/chat/chatLib';
import { conversation } from '@/common/adapter/ipcBridge';
import { Button, Card, Form, Input, InputNumber, Select, Switch, Typography } from '@arco-design/web-react';
import React, { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Help, LinkOne } from '@icon-park/react';

const { Text } = Typography;
const FormItem = Form.Item;

interface MessageAcpElicitationProps {
  message: IMessageAcpElicitation;
}

interface SchemaProperty {
  type?: string;
  title?: string;
  description?: string;
  enum?: string[];
  oneOf?: Array<{ const: string; title?: string }>;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  format?: string;
  default?: unknown;
}

interface JsonSchema {
  type?: string;
  properties?: Record<string, SchemaProperty>;
  required?: string[];
}

/**
 * Render a form field based on JSON Schema property
 */
const SchemaField: React.FC<{
  name: string;
  property: SchemaProperty;
  value: unknown;
  onChange: (value: unknown) => void;
}> = ({ name, property, value, onChange }) => {
  const { t } = useTranslation();
  const { type, title, description, enum: enumValues, oneOf, minimum, maximum } = property;

  const label = title || name;
  const placeholder = description || t('acp.elicitation.enterValue');

  // Handle enum/oneOf as Select
  if (enumValues || oneOf) {
    const options = enumValues
      ? enumValues.map((v) => ({ label: v, value: v }))
      : oneOf?.map((item) => ({ label: item.title || item.const, value: item.const })) || [];

    return (
      <FormItem label={label} help={description}>
        <Select
          value={value as string}
          onChange={(v) => onChange(v)}
          placeholder={placeholder}
          options={options}
          style={{ width: '100%' }}
        />
      </FormItem>
    );
  }

  // Handle boolean as Switch
  if (type === 'boolean') {
    return (
      <FormItem label={label} help={description}>
        <Switch checked={value as boolean} onChange={(v) => onChange(v)} />
      </FormItem>
    );
  }

  // Handle number/integer as InputNumber
  if (type === 'number' || type === 'integer') {
    return (
      <FormItem label={label} help={description}>
        <InputNumber
          value={value as number}
          onChange={(v) => onChange(v)}
          placeholder={placeholder}
          min={minimum}
          max={maximum}
          style={{ width: '100%' }}
        />
      </FormItem>
    );
  }

  // Default: string input
  return (
    <FormItem label={label} help={description}>
      <Input
        value={value as string}
        onChange={(v) => onChange(v)}
        placeholder={placeholder}
        style={{ width: '100%' }}
      />
    </FormItem>
  );
};

/**
 * Form mode elicitation component
 */
const FormElicitation: React.FC<{
  message: IMessageAcpElicitation;
  schema: JsonSchema;
  onSubmit: () => void;
  onCancel: () => void;
}> = ({ message, schema, onSubmit, onCancel }) => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);

  const properties = schema.properties || {};
  const required = schema.required || [];

  const handleFieldChange = useCallback((name: string, value: unknown) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  }, []);

  const handleSubmit = async () => {
    if (isSubmitting) return;

    // Validate required fields
    for (const fieldName of required) {
      if (formData[fieldName] === undefined || formData[fieldName] === '') {
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const invokeData = {
        action: 'accept' as const,
        content: formData,
        msg_id: message.id,
        conversation_id: message.conversation_id,
        callId: message.content.callId,
      };

      const result = await conversation.confirmElicitation.invoke(invokeData);

      if (result.success) {
        setHasSubmitted(true);
        onSubmit();
      } else {
        console.error('Failed to submit elicitation:', result);
      }
    } catch (error) {
      console.error('Error submitting elicitation:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = async () => {
    try {
      const invokeData = {
        action: 'decline' as const,
        reason: 'User cancelled',
        msg_id: message.id,
        conversation_id: message.conversation_id,
        callId: message.content.callId,
      };

      await conversation.confirmElicitation.invoke(invokeData);
      onCancel();
    } catch (error) {
      console.error('Error cancelling elicitation:', error);
    }
  };

  if (hasSubmitted) {
    return (
      <div
        className='mt-10px p-2 rounded-md border'
        style={{ backgroundColor: 'var(--color-success-light-1)', borderColor: 'rgb(var(--success-3))' }}
      >
        <Text className='text-sm' style={{ color: 'rgb(var(--success-6))' }}>
          ✓ {t('acp.elicitation.submitted')}
        </Text>
      </div>
    );
  }

  return (
    <Form layout='vertical'>
      {Object.entries(properties).map(([name, property]) => (
        <SchemaField
          key={name}
          name={name}
          property={property}
          value={formData[name] ?? property.default}
          onChange={(v) => handleFieldChange(name, v)}
        />
      ))}
      <FormItem>
        <div className='flex gap-2'>
          <Button type='primary' loading={isSubmitting} onClick={handleSubmit}>
            {t('acp.elicitation.submit')}
          </Button>
          <Button onClick={handleCancel}>{t('acp.elicitation.cancel')}</Button>
        </div>
      </FormItem>
    </Form>
  );
};

/**
 * URL mode elicitation component
 */
const UrlElicitation: React.FC<{
  message: IMessageAcpElicitation;
  url: string;
  onComplete: () => void;
}> = ({ message, url, onComplete }) => {
  const { t } = useTranslation();
  const [isOpening, setIsOpening] = useState(false);
  const [hasCompleted, setHasCompleted] = useState(false);

  const handleOpen = async () => {
    setIsOpening(true);
    try {
      // Open URL in external browser
      await conversation.openExternalUrl.invoke({ url });

      // Mark as waiting for completion
      setHasCompleted(true);
      onComplete();
    } catch (error) {
      console.error('Error opening URL:', error);
    } finally {
      setIsOpening(false);
    }
  };

  if (hasCompleted) {
    return (
      <div
        className='mt-10px p-2 rounded-md border'
        style={{ backgroundColor: 'var(--color-info-light-1)', borderColor: 'rgb(var(--info-3))' }}
      >
        <Text className='text-sm' style={{ color: 'rgb(var(--info-6))' }}>
          {t('acp.elicitation.openedInBrowser')}
        </Text>
      </div>
    );
  }

  return (
    <div className='space-y-4'>
      <div className='flex items-center gap-2 p-3 rounded-md bg-fill-1'>
        <LinkOne className='text-t-secondary' />
        <Text className='text-sm flex-1 truncate'>{url}</Text>
      </div>
      <div className='flex gap-2'>
        <Button type='primary' loading={isOpening} onClick={handleOpen}>
          {t('acp.elicitation.openUrl')}
        </Button>
      </div>
    </div>
  );
};

const MessageAcpElicitation: React.FC<MessageAcpElicitationProps> = React.memo(({ message }) => {
  const { t } = useTranslation();
  const { content } = message;
  const { mode, message: elicitationMessage, requestedSchema, url, callId } = content || {};

  if (!callId) {
    return null;
  }

  return (
    <Card className='mb-4' bordered={false} style={{ background: 'var(--bg-1)' }}>
      <div className='space-y-4'>
        {/* Header with icon and title */}
        <div className='flex items-center space-x-2'>
          <Help className='text-xl text-primary' />
          <Text className='block font-medium'>{elicitationMessage || t('acp.elicitation.title')}</Text>
        </div>

        {/* Mode-specific content */}
        {mode === 'form' && requestedSchema && (
          <FormElicitation
            message={message}
            schema={requestedSchema as JsonSchema}
            onSubmit={() => {}}
            onCancel={() => {}}
          />
        )}

        {mode === 'url' && url && <UrlElicitation message={message} url={url} onComplete={() => {}} />}
      </div>
    </Card>
  );
});

export default MessageAcpElicitation;
