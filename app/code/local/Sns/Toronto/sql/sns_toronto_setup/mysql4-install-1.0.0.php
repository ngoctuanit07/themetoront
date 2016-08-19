<?php

$this->startSetup();

$categoryEntityTypeId = $this->getEntityTypeId('catalog_category');

$this->removeAttribute($categoryEntityTypeId, 'toronto_menulink');
$this->addAttribute($categoryEntityTypeId, 'toronto_menulink', array(
    'group'				=> 'Toronto Menu',
    'label'				=> 'Hide link',
    'note'				=> "This field is applicable only for top-level categories.",
    'type'				=> 'varchar',
    'input'				=> 'select',
    'source'			=> 'toronto/system_config_source_category_status',
    'visible'			=> true,
    'required'			=> false,
    'backend'			=> '',
    'frontend'			=> '',
    'searchable'		=> false,
    'filterable'		=> false,
    'comparable'		=> false,
    'user_defined'		=> true,
    'visible_on_front'	=> true,
    'wysiwyg_enabled'	=> false,
    'is_html_allowed_on_front'	=> false,
    'global'			=> Mage_Catalog_Model_Resource_Eav_Attribute::SCOPE_STORE,
 ));

$this->removeAttribute($categoryEntityTypeId, 'toronto_groupsubcat');
$this->addAttribute($categoryEntityTypeId, 'toronto_groupsubcat', array(
    'group'				=> 'Toronto Menu',
    'label'				=> 'Group Subcategories',
    'note'				=> "This field is applicable only for top-level categories.",
    'type'				=> 'varchar',
    'input'				=> 'select',
    'source'			=> 'toronto/system_config_source_category_status',
    'visible'			=> true,
    'required'			=> false,
    'backend'			=> '',
    'frontend'			=> '',
    'searchable'		=> false,
    'filterable'		=> false,
    'comparable'		=> false,
    'user_defined'		=> true,
    'visible_on_front'	=> true,
    'wysiwyg_enabled'	=> false,
    'is_html_allowed_on_front'	=> false,
    'global'			=> Mage_Catalog_Model_Resource_Eav_Attribute::SCOPE_STORE,
 ));

$this->removeAttribute($categoryEntityTypeId, 'toronto_subcat_w');
$this->addAttribute($categoryEntityTypeId, 'toronto_subcat_w', array(
    'group'				=> 'Toronto Menu',
    'label'				=> 'Width for subcategories block',
    'note'				=> "This field is applicable only for top-level categories and drop with subcategories and blocks.",
    'type'				=> 'varchar',
    'input'				=> 'select',
    'source'			=> 'toronto/system_config_source_category_colWidth',
    'visible'			=> true,
    'required'			=> false,
    'backend'			=> '',
    'frontend'			=> '',
    'searchable'		=> false,
    'filterable'		=> false,
    'comparable'		=> false,
    'user_defined'		=> true,
    'visible_on_front'	=> true,
    'wysiwyg_enabled'	=> false,
    'is_html_allowed_on_front'	=> false,
    'global'			=> Mage_Catalog_Model_Resource_Eav_Attribute::SCOPE_STORE,
 ));

$this->removeAttribute($categoryEntityTypeId, 'toronto_subcat_colw');
$this->addAttribute($categoryEntityTypeId, 'toronto_subcat_colw', array(
    'group'				=> 'Toronto Menu',
    'label'				=> 'Col width for subcategories',
    'note'				=> "This field is applicable only for top-level categories and group subcategories.",
    'type'				=> 'varchar',
    'input'				=> 'select',
    'source'			=> 'toronto/system_config_source_category_colWidth',
    'visible'			=> true,
    'required'			=> false,
    'backend'			=> '',
    'frontend'			=> '',
    'searchable'		=> false,
    'filterable'		=> false,
    'comparable'		=> false,
    'user_defined'		=> true,
    'visible_on_front'	=> true,
    'wysiwyg_enabled'	=> false,
    'is_html_allowed_on_front'	=> false,
    'global'			=> Mage_Catalog_Model_Resource_Eav_Attribute::SCOPE_STORE,
 ));

$this->removeAttribute($categoryEntityTypeId, 'toronto_menutype');
$this->addAttribute($categoryEntityTypeId, 'toronto_menutype', array(
    'group'				=> 'Toronto Menu',
    'label'				=> 'Dropdown with',
    'note'				=> "This field is applicable only for top-level categories.",
    'type'				=> 'varchar',
    'input'				=> 'select',
    'source'			=> 'toronto/system_config_source_category_types',
    'visible'			=> true,
    'required'			=> false,
    'backend'			=> '',
    'frontend'			=> '',
    'searchable'		=> false,
    'filterable'		=> false,
    'comparable'		=> false,
    'user_defined'		=> true,
    'visible_on_front'	=> true,
    'wysiwyg_enabled'	=> false,
    'is_html_allowed_on_front'	=> false,
    'global'			=> Mage_Catalog_Model_Resource_Eav_Attribute::SCOPE_STORE,
 ));

$this->removeAttribute($categoryEntityTypeId, 'toronto_block_r');
$this->addAttribute($categoryEntityTypeId, 'toronto_block_r', array(
	'group'				=> 'Toronto Menu',
	'label'				=> 'Block Right',
	'note'				=> "This field is applicable only for top-level categories.",
	'input'         	=> 'textarea',
	'type'          	=> 'text',
	'visible'       	=> true,
	'required'      	=> false,
	'user_defined'  	=> true,
	'global'        	=> Mage_Catalog_Model_Resource_Eav_Attribute::SCOPE_GLOBAL,
 ));

$this->removeAttribute($categoryEntityTypeId, 'toronto_block_t');
$this->addAttribute($categoryEntityTypeId, 'toronto_block_t', array(
	'group'				=> 'Toronto Menu',
	'label'				=> 'Block Top',
	'note'				=> "This field is applicable only for top-level categories.",
	'input'         	=> 'textarea',
	'type'          	=> 'text',
	'visible'       	=> true,
	'required'      	=> false,
	'user_defined'  	=> true,
	'global'        	=> Mage_Catalog_Model_Resource_Eav_Attribute::SCOPE_GLOBAL,
 ));

$this->removeAttribute($categoryEntityTypeId, 'toronto_block_b');
$this->addAttribute($categoryEntityTypeId, 'toronto_block_b', array(
	'group'				=> 'Toronto Menu',
	'label'				=> 'Block Bottom',
	'note'				=> "This field is applicable only for top-level categories.",
	'input'         	=> 'textarea',
	'type'          	=> 'text',
	'visible'       	=> true,
	'required'      	=> false,
	'user_defined'  	=> true,
	'global'        	=> Mage_Catalog_Model_Resource_Eav_Attribute::SCOPE_GLOBAL,
 ));

/*Adds WYSIWYG Support*/
$this->updateAttribute($categoryEntityTypeId, 'toronto_block_l', 'is_wysiwyg_enabled', 1);
$this->updateAttribute($categoryEntityTypeId, 'toronto_block_l', 'is_html_allowed_on_front', 1);
$this->updateAttribute($categoryEntityTypeId, 'toronto_block_r', 'is_wysiwyg_enabled', 1);
$this->updateAttribute($categoryEntityTypeId, 'toronto_block_r', 'is_html_allowed_on_front', 1);
$this->updateAttribute($categoryEntityTypeId, 'toronto_block_t', 'is_wysiwyg_enabled', 1);
$this->updateAttribute($categoryEntityTypeId, 'toronto_block_t', 'is_html_allowed_on_front', 1);
$this->updateAttribute($categoryEntityTypeId, 'toronto_block_b', 'is_wysiwyg_enabled', 1);
$this->updateAttribute($categoryEntityTypeId, 'toronto_block_b', 'is_html_allowed_on_front', 1);

$this->endSetup();

?>