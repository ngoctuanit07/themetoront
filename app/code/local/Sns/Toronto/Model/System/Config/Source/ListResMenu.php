<?php

class Sns_Toronto_Model_System_Config_Source_ListResMenu
{
	public function toOptionArray()
	{
		return array(
			array('value'=>'sidebar', 'label'=>Mage::helper('toronto')->__('SideBar')),
			array('value'=>'collapse', 'label'=>Mage::helper('toronto')->__('Collapse'))
		);
	}
}
